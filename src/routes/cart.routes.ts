import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
} from '../controllers/cart.controller.js';
import { optionalProtect } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(optionalProtect);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCartItem);
router.delete('/remove', removeFromCart);
router.post('/remove', removeFromCart);

export default router;
