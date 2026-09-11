export type Variant={id:string;sku:string;color:string;size:string;price:number;salePrice?:number;stock:number;tone:string};
export type Product={id:string;slug:string;name:string;brand:string;brandId:string;category:string;categoryId:string;gender:string;shape:string;material:string;color:string;lens:string;price:number;salePrice?:number;tone:string;isNew?:boolean;isBestSeller?:boolean;stock:number;description:string;measurements:string;variantId:string;sku:string;prescriptionAllowed:boolean;active:boolean;featured:boolean;images:{id:string;url:string;alt:string;color?:string|null}[];variants:Variant[];reviews:{id:string;rating:number;body:string;createdAt:string;user:{name:string}}[]};
export type PageResult<T>={items:T[];total:number;page:number;pages?:number};
export type Facets={categories:{id:string;name:string;slug:string}[];brands:{id:string;name:string;slug:string}[];genders:string[];shapes:string[];materials:string[];lenses:string[];colors:string[]};
export const formatPrice=(value:number)=>new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT',maximumFractionDigits:2}).format(value);
export const money=(minor:number)=>formatPrice(minor/100);
