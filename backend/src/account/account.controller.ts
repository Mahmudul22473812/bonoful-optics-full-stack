import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiConsumes, ApiTags } from "@nestjs/swagger";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Response } from "express";
import { z } from "zod";
import {
  AuthRequest,
  hasPermission,
  Public,
  userView,
} from "../core/auth.guard";
import { PrismaService } from "../core/prisma.service";
import { RateLimitService } from "../core/rate-limit.service";
import { decrypt, encrypt, token } from "../core/security";
import { config } from "../core/config";
import { normalizeImage } from "../core/image-upload";

const addressSchema = z
  .object({
    label: z.string().min(1).max(40),
    name: z.string().min(2).max(100),
    phone: z.string().min(7).max(25),
    line1: z.string().min(5).max(200),
    line2: z.string().max(200).optional(),
    city: z.string().min(2).max(80),
    postalCode: z.string().min(2).max(12),
    country: z.literal("BD").default("BD"),
    isDefault: z.boolean().default(false),
  })
  .strict();
const eye = z
  .object({
    sph: z.number().min(-30).max(30),
    cyl: z.number().min(-10).max(10),
    axis: z.number().int().min(0).max(180),
    add: z.number().min(0).max(6).optional(),
  })
  .strict();
const prescriptionSchema = z
  .object({
    label: z.string().min(2).max(80),
    od: eye,
    os: eye,
    pd: z.number().min(40).max(85),
    notes: z.string().max(1000).optional(),
    fileId: z.string().optional(),
  })
  .strict();

@ApiTags("Customer account")
@Controller()
export class AccountController {
  constructor(
    private readonly db: PrismaService,
    private readonly rate: RateLimitService,
  ) {}
  @Get("profile") profile(@Req() req: AuthRequest) {
    return userView(req.actor!);
  }
  @Patch("profile") async update(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const data = z
      .object({
        name: z.string().trim().min(2).max(100),
        phone: z.string().max(25).optional(),
      })
      .strict()
      .parse(body);
    await this.db.user.update({ where: { id: req.actor!.id }, data });
    return { message: "Profile updated." };
  }
  @Get("addresses") addresses(@Req() req: AuthRequest) {
    return this.db.address.findMany({
      where: { userId: req.actor!.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }
  @Post("addresses") createAddress(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const data = addressSchema.parse(body);
    return this.db.atomic(async (tx) => {
      if (data.isDefault)
        await tx.address.updateMany({
          where: { userId: req.actor!.id },
          data: { isDefault: false },
        });
      return tx.address.create({ data: { ...data, userId: req.actor!.id } });
    });
  }
  @Patch("addresses/:id") editAddress(
    @Param("id") id: string,
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const data = addressSchema.parse(body);
    return this.db.atomic(async (tx) => {
      if (data.isDefault)
        await tx.address.updateMany({
          where: { userId: req.actor!.id },
          data: { isDefault: false },
        });
      return tx.address.update({ where: { id, userId: req.actor!.id }, data });
    });
  }
  @Delete("addresses/:id") deleteAddress(
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    return this.db.address.deleteMany({ where: { id, userId: req.actor!.id } });
  }
  @Get("prescriptions") prescriptions(@Req() req: AuthRequest) {
    return this.db.prescription.findMany({
      where: { userId: req.actor!.id },
      select: { id: true, label: true, createdAt: true, fileId: true },
    });
  }
  @Get("prescriptions/:id") async prescription(
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    const prescription = await this.db.prescription.findFirst({
      where: {
        id,
        ...(hasPermission(req.actor!, "prescriptions.read")
          ? {}
          : { userId: req.actor!.id }),
      },
    });
    if (!prescription) throw new NotFoundException("Prescription not found.");
    await this.db.auditLog.create({
      data: {
        actorId: req.actor!.id,
        action: "prescriptions.read",
        entity: "prescription",
        entityId: id,
      },
    });
    return {
      id,
      label: prescription.label,
      fileId: prescription.fileId,
      values: JSON.parse(
        decrypt(prescription.encryptedValues).toString(),
      ) as unknown,
    };
  }
  @Post("prescriptions") async savePrescription(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const { label, fileId, ...values } = prescriptionSchema.parse(body);
    await this.rate.check("prescription", req.actor!.id, 20, 60);
    if (
      fileId &&
      !(await this.db.file.findFirst({
        where: { id: fileId, ownerId: req.actor!.id, private: true },
      }))
    )
      throw new BadRequestException("Invalid prescription file.");
    return this.db.atomic(async (tx) => {
      const record = await tx.prescription.create({
        data: {
          userId: req.actor!.id,
          label,
          fileId,
          encryptedValues: encrypt(JSON.stringify(values)),
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: req.actor!.id,
          action: "prescriptions.create",
          entity: "prescription",
          entityId: record.id,
        },
      });
      return { id: record.id, label: record.label };
    });
  }
  @Post("files")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("purpose") purpose: string,
    @Req() req: AuthRequest,
  ) {
    await this.rate.check("upload", req.actor!.id, 20, 60);
    if (!file || !["product", "prescription"].includes(purpose))
      throw new BadRequestException("Choose a file and its purpose.");
    if (
      purpose === "product" &&
      !hasPermission(req.actor!, "products.update") &&
      !hasPermission(req.actor!, "products.create")
    )
      throw new BadRequestException("Product image permission is required.");
    let bytes = file.buffer;
    let mime = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        ? "image/jpeg"
        : bytes.subarray(0, 4).toString() === "RIFF" &&
            bytes.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : bytes.subarray(0, 5).toString() === "%PDF-"
            ? "application/pdf"
            : null;
    // Trust the decoded file signature rather than the browser-provided MIME
    // label. Windows may report valid JPG/JFIF/WebP uploads as
    // application/octet-stream; Sharp still fully decodes and normalizes every
    // image below before it is stored.
    if (!mime || (purpose === "product" && mime === "application/pdf"))
      throw new BadRequestException(
        "Use a valid JPEG, PNG, WebP or prescription PDF (maximum 5 MB).",
      );
    if (mime !== "application/pdf") {
      bytes = await normalizeImage(bytes);
      mime = "image/webp";
    }
    const key = token();
    const isPrivate = purpose === "prescription";
    const root = resolve(config.FILE_ROOT);
    await mkdir(root, { recursive: true });
    await writeFile(resolve(root, key), isPrivate ? encrypt(bytes) : bytes, {
      mode: 0o600,
    });
    const saved = await this.db.file.create({
      data: {
        ownerId: req.actor!.id,
        key,
        mime,
        size: bytes.length,
        private: isPrivate,
      },
    });
    await this.db.auditLog.create({
      data: {
        actorId: req.actor!.id,
        action: "files.upload",
        entity: "file",
        entityId: saved.id,
      },
    });
    return {
      id: saved.id,
      url: `/api/v1/files/${saved.id}`,
      private: isPrivate,
    };
  }
  @Public() @Get("files/:id") async file(
    @Param("id") id: string,
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    const file = await this.db.file.findUnique({ where: { id } });
    if (
      !file ||
      (file.private &&
        (!req.actor ||
          (file.ownerId !== req.actor.id &&
            !hasPermission(req.actor, "prescriptions.read"))))
    )
      throw new NotFoundException("File not found.");
    if (file.private)
      await this.db.auditLog.create({
        data: {
          actorId: req.actor!.id,
          action: "prescriptions.file.read",
          entity: "file",
          entityId: id,
        },
      });
    const stored = await readFile(resolve(config.FILE_ROOT, file.key));
    res.setHeader("Content-Type", file.mime);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Cache-Control",
      file.private ? "private, no-store" : "public, max-age=86400",
    );
    if (file.private)
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="prescription.${file.mime === "application/pdf" ? "pdf" : file.mime.split("/")[1]}"`,
      );
    res.send(file.private ? decrypt(stored.toString()) : stored);
  }
  @Get("notifications") notifications(@Req() req: AuthRequest) {
    return this.db.notification.findMany({
      where: { userId: req.actor!.id },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
  }
  @Patch("notifications/:id") readNotification(
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    return this.db.notification.updateMany({
      where: { id, userId: req.actor!.id },
      data: { readAt: new Date() },
    });
  }
  @Get("reviews") reviews(@Req() req: AuthRequest) {
    return this.db.review.findMany({
      where: { userId: req.actor!.id },
      include: { product: { select: { name: true, slug: true } } },
      take: 50,
    });
  }
  @Delete("reviews/:id") deleteReview(
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    return this.db.review.deleteMany({ where: { id, userId: req.actor!.id } });
  }
  @Public() @Post("newsletter") async newsletter(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const data = z
      .object({ email: z.email().transform((v) => v.toLowerCase()) })
      .strict()
      .parse(body);
    await this.rate.check("newsletter", req.ip ?? "unknown", 5, 60);
    await this.db.newsletter.upsert({
      where: { email: data.email },
      create: data,
      update: {},
    });
    return { message: "Thank you. You are on the list." };
  }
  @Public() @Post("appointments") async appointment(
    @Body() body: unknown,
    @Req() req: AuthRequest,
  ) {
    const data = z
      .object({
        name: z.string().min(2).max(100),
        email: z.email(),
        phone: z.string().min(7).max(25),
        service: z.enum([
          "Eye examination",
          "Lens consultation",
          "Frame fitting",
        ]),
        preferredAt: z.iso
          .datetime()
          .refine((v) => new Date(v) > new Date(), "Choose a future date."),
      })
      .strict()
      .parse(body);
    await this.rate.check("appointment", req.ip ?? "unknown", 5, 60);
    const appointment = await this.db.appointment.create({ data });
    return {
      id: appointment.id,
      message:
        "Appointment requested. Our team will contact you to confirm availability.",
    };
  }
}
