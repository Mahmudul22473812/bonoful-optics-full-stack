import {expect,test} from 'vitest';
import {imagesForColour} from '@/lib/product-images';
import type {Product} from '@/lib/catalog';
const general={id:'general',url:'/general.jpg',alt:'General photo'};
const black={id:'black',url:'/black.jpg',alt:'Black frame',color:'Black'};
const product={images:[general,black]} as Product;
test('selects matching colour photos case-insensitively',()=>{expect(imagesForColour(product,'black')).toEqual([black]);});
test('falls back only to general photos, not another colour',()=>{expect(imagesForColour(product,'Gold')).toEqual([general]);expect(imagesForColour({...product,images:[black]},'Gold')).toEqual([]);});
