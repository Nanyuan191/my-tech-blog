import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/auth';
import { wrap } from '../middlewares/errorHandler';

/**
 * 鉴权路由
 * ------------------------------------------------------------
 * 路由文件的职责：把「HTTP 方法 + 路径」映射到 controller 函数上。
 * 不写任何业务逻辑，这样才能一眼看出系统对外暴露了哪些接口。
 *
 * 这里给登录接口单独加了限流 —— 这是安全上必须做的一件事。
 */

const authRouter = Router();

/**
 * 登录限流
 *
 * 为什么必须做？如果没有限流，攻击者可以用脚本每秒试几千次密码。
 * bcrypt 虽然慢（每次约 100ms）能起到一定阻碍，但配合代理池依然可能撞库成功。
 *
 * 策略：同一 IP 15 分钟内最多 10 次尝试，超出直接 429。
 * 正常用户一天登录一次，10 次完全够用；而暴力破解需要百万次量级，
 * 被限流后攻击成本高到不可接受。
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: '登录尝试过于频繁，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false,
});

// wrap() 把 async 函数抛出的异常自动转给 next()，
// 否则 Express 4 捕获不到 async 错误，请求会一直挂直到超时。
// （Express 5 原生支持 async 错误，但我们用的是 4.x）
authRouter.post('/login', loginLimiter, wrap(authController.login));
authRouter.post('/refresh', wrap(authController.refresh));
authRouter.post('/logout', wrap(authController.logout));
authRouter.get('/me', requireAuth, wrap(authController.me));
authRouter.put('/password', requireAuth, wrap(authController.changePassword));

export { authRouter };
