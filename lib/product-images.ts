import type {Product} from './catalog';
export function imagesForColour(product:Product,colour:string){
 const match=product.images.filter(image=>image.color?.trim().toLowerCase()===colour.trim().toLowerCase());
 return match.length?match:product.images.filter(image=>!image.color);
}
