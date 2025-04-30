import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// User registration
export async function registerUser(email: string, password: string, name?: string) {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        name,
      },
    });
    
    return { id: user.id, email: user.email, name: user.name };
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('Email already exists');
    }
    throw error;
  }
}

// User login
export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new Error('Invalid password');
  }
  
  if (!user.isApproved) {
    throw new Error('Account not approved');
  }
  
  const token = jwt.sign(
    { userId: user.id, email: user.email, isAdmin: user.isAdmin },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  return { token, user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin } };
}

// Generate API token
export async function generateApiToken(userId: number, tokenName: string, expiresIn?: Date) {
  const token = crypto.randomBytes(32).toString('hex');
  
  const apiToken = await prisma.apiToken.create({
    data: {
      token,
      name: tokenName,
      userId,
      expiresAt: expiresIn,
    },
  });
  
  return apiToken;
}

// Authentication middleware
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    // First try as JWT token
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      
      if (!user || !user.isApproved) {
        return res.status(403).json({ error: 'User not approved or does not exist' });
      }
      
      req.user = user;
      return next();
    } catch (jwtError) {
      // If not a valid JWT, try as API token
      const apiToken = await prisma.apiToken.findUnique({
        where: { token },
        include: { user: true },
      });
      
      if (!apiToken || apiToken.isRevoked || 
          (apiToken.expiresAt && apiToken.expiresAt < new Date())) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      if (!apiToken.user.isApproved) {
        return res.status(403).json({ error: 'User not approved' });
      }
      
      // Update last used timestamp
      await prisma.apiToken.update({
        where: { id: apiToken.id },
        data: { lastUsed: new Date() },
      });
      
      req.user = apiToken.user;
      return next();
    }
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}