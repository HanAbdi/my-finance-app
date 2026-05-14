const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// --- MIDDLEWARE ---
const requireAuth = (req, res, next) => {
  const userId = req.headers['user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Akses ditolak! Lu harus login dulu.' });
  }
  req.userId = userId;
  next();
};

app.get('/', (req, res) => {
  res.send('Server Finance Tracker Aman Terkendali 🔒');
});

// --- API ROUTES ---

// Ambil Budget
app.get('/api/budget', requireAuth, async (req, res) => {
  try {
    let profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    // Kalau user belum punya profile, kita bikinin otomatis budgetnya 0
    if (!profile) {
      profile = await prisma.profile.create({ data: { userId: req.userId, monthlyBudget: 0 } });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Budget
app.put('/api/budget', requireAuth, async (req, res) => {
  const { monthlyBudget } = req.body;
  try {
    // upsert = Update kalau ada, Insert (bikin baru) kalau belum ada
    const profile = await prisma.profile.upsert({
      where: { userId: req.userId },
      update: { monthlyBudget: parseFloat(monthlyBudget) },
      create: { userId: req.userId, monthlyBudget: parseFloat(monthlyBudget) }
    });
    res.json(profile);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 1. Ambil Kategori
app.get('/api/categories', requireAuth, async (req, res) => {
  try {
    let categories = await prisma.category.findMany({
      where: { userId: req.userId }
    });

    if (categories.length === 0) {
      await prisma.category.createMany({
        data: [
          { name: 'Makan', type: 'expense', userId: req.userId },
          { name: 'Transport', type: 'expense', userId: req.userId },
          { name: 'Gaji', type: 'income', userId: req.userId },
          { name: 'Freelance', type: 'income', userId: req.userId }
        ]
      });

      categories = await prisma.category.findMany({
        where: { userId: req.userId }
      });
    }

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Tambah Kategori (UPDATE)
app.post('/api/categories', requireAuth, async (req, res) => {
  const { name, type } = req.body;
  try {
    const newCategory = await prisma.category.create({
      data: {
        name,
        type: type || 'expense',
        userId: req.userId,
      },
    });
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2. Ambil Transaksi User
app.get('/api/transactions', requireAuth, async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.userId },
    include: { category: true },
    orderBy: { date: 'desc' }
  });
  res.json(transactions);
});

// 3. Tambah Transaksi (UPDATE)
app.post('/api/transactions', requireAuth, async (req, res) => {
  const { amount, type, description, categoryId, date } = req.body;
  try {
    const newTransaction = await prisma.transaction.create({
      data: {
        amount: parseFloat(amount),
        type,
        description,
        categoryId: parseInt(categoryId),
        userId: req.userId,
        date: date ? new Date(date) : new Date(),
      },
    });
    res.status(201).json(newTransaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Edit Transaksi (UPDATE)
app.put('/api/transactions/:id', requireAuth, async (req, res) => {
  const { amount, type, description, categoryId, date } = req.body;
  try {
    const updatedTransaction = await prisma.transaction.updateMany({
      where: { 
        id: parseInt(req.params.id),
        userId: req.userId
      },
      data: {
        amount: parseFloat(amount),
        type,
        description,
        categoryId: parseInt(categoryId),
        date: date ? new Date(date) : new Date(), // <-- Update baris ini
      },
    });
    res.json(updatedTransaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5. Hapus Transaksi
app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  try {
    await prisma.transaction.deleteMany({
      where: { 
        id: parseInt(req.params.id),
        userId: req.userId
      },
    });
    res.json({ message: 'Transaksi berhasil dihapus' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`API Server nyala & digembok di http://localhost:${PORT}`);
});