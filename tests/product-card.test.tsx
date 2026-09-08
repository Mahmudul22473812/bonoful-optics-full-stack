import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {beforeEach,expect,test,vi} from 'vitest';
import type {Product} from '@/lib/catalog';
import {ProductCard} from '@/components/product-card';
const mock=vi.hoisted(()=>({addToCart:vi.fn(),toggleWishlist:vi.fn(),ready:true}));
vi.mock('@/components/commerce-provider',()=>({useCommerce:()=>({...mock,wishlist:[]})}));
vi.mock('next/link',()=>({default:({children,...props}:any)=><a {...props}>{children}</a>}));
vi.mock('next/image',()=>({default:({fill,sizes,...props}:any)=><img {...props}/>}));
const product={id:'p1',slug:'arden',name:'Arden',material:'Acetate',color:'Black',price:4850,variantId:'v1',images:[],variants:[{id:'v1',stock:3}]} as unknown as Product;
beforeEach(()=>{vi.clearAllMocks();mock.ready=true;mock.addToCart.mockResolvedValue(undefined);});
test('adds the selected product and restores the action',async()=>{
 render(<ProductCard product={product}/>);fireEvent.click(screen.getByRole('button',{name:'Add to cart'}));
 await waitFor(()=>expect(mock.addToCart).toHaveBeenCalledWith(product));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Add to cart'})).toBeEnabled());
});
test('out-of-stock products cannot be added',()=>{
 render(<ProductCard product={{...product,variants:[{...product.variants[0],stock:0}]}}/>);
 expect(screen.getByRole('button',{name:'Out of stock'})).toBeDisabled();
});
test('multi-variant products ask customers to choose options',()=>{
 render(<ProductCard product={{...product,variants:[...product.variants,{...product.variants[0],id:'v2'}]}}/>);
 expect(screen.getByRole('link',{name:/Choose options/})).toHaveAttribute('href','/products/arden');
 expect(screen.queryByRole('button',{name:'Add to cart'})).not.toBeInTheDocument();
});
test('waits for the shopping session before enabling purchase',()=>{
 mock.ready=false;render(<ProductCard product={product}/>);
 expect(screen.getByRole('button',{name:'Add to cart'})).toBeDisabled();
});
test('failed add does not leave a permanently disabled action',async()=>{
 mock.addToCart.mockRejectedValue(new Error('Unavailable'));render(<ProductCard product={product}/>);
 fireEvent.click(screen.getByRole('button',{name:'Add to cart'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Add to cart'})).toBeEnabled());
});
