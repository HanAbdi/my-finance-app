import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Trash2, Edit2, LogOut, Wallet, TrendingUp, TrendingDown, Target, Search, Moon, Sun, Download } from 'lucide-react'
import { supabase } from './supabase'
import toast, { Toaster } from 'react-hot-toast'

const COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899']

const MONTHS = [
  { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' }, { value: 3, label: 'Maret' },
  { value: 4, label: 'April' }, { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' }, { value: 8, label: 'Agustus' }, { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' }, { value: 11, label: 'November' }, { value: 12, label: 'Desember' }
]

const getTodayDate = () => new Date().toISOString().split('T')[0]

function App() {
  const [session, setSession] = useState(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  const [formData, setFormData] = useState({ 
    amount: '', type: 'expense', description: '', categoryId: '', date: getTodayDate() 
  })

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [budget, setBudget] = useState(0)
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false)
  const [editBudgetAmount, setEditBudgetAmount] = useState('')

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) fetchData()
  }, [session])

  const axiosConfig = { headers: { 'user-id': session?.user?.id } }

  const fetchData = async () => {
    try {
      const catRes = await axios.get('http://localhost:5000/api/categories', axiosConfig)
      const transRes = await axios.get('http://localhost:5000/api/transactions', axiosConfig)
      const budgetRes = await axios.get('http://localhost:5000/api/budget', axiosConfig) 
      
      setCategories(catRes.data)
      setTransactions(transRes.data)
      setBudget(budgetRes.data?.monthlyBudget || 0) 

      if (catRes.data.length > 0 && !editingId) {
        const defaultCat = catRes.data.find(c => c.type === formData.type)
        if (defaultCat) setFormData(prev => ({ ...prev, categoryId: defaultCat.id }))
      }
    } catch (error) {
      toast.error("Gagal mengambil data")
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    try {
      if (isLoginMode) {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
        if (error) throw error
        toast.success("Login berhasil")
      } else {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword })
        if (error) throw error
        toast.success("Registrasi berhasil")
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setTransactions([])
    setCategories([])
    toast.success("Berhasil keluar")
  }

  const handleTransactionSubmit = async (e) => {
    e.preventDefault()
    try {
      if (!formData.categoryId) return toast.error("Pilih kategori terlebih dahulu")

      if (editingId) {
        await axios.put(`http://localhost:5000/api/transactions/${editingId}`, formData, axiosConfig)
        toast.success("Transaksi berhasil diperbarui")
        setEditingId(null)
      } else {
        await axios.post('http://localhost:5000/api/transactions', formData, axiosConfig)
        toast.success("Transaksi berhasil disimpan")
      }
      setFormData({ ...formData, amount: '', description: '', date: getTodayDate() })
      fetchData()
    } catch (error) {
      toast.error("Gagal menyimpan transaksi")
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus data ini?")) return
    try {
      await axios.delete(`http://localhost:5000/api/transactions/${id}`, axiosConfig)
      toast.success("Transaksi berhasil dihapus")
      fetchData()
    } catch (error) {
      toast.error("Gagal menghapus data")
    }
  }

  const submitNewCategory = async (e) => {
    e.preventDefault()
    if (!newCategoryName.trim()) return
    try {
      await axios.post('http://localhost:5000/api/categories', { name: newCategoryName, type: formData.type }, axiosConfig)
      toast.success(`Kategori "${newCategoryName}" berhasil ditambahkan`)
      setIsCategoryModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error("Gagal menambah kategori")
    }
  }

  const submitNewBudget = async (e) => {
    e.preventDefault()
    try {
      await axios.put('http://localhost:5000/api/budget', { monthlyBudget: editBudgetAmount }, axiosConfig)
      toast.success(`Target anggaran berhasil diperbarui`)
      setIsBudgetModalOpen(false)
      fetchData()
    } catch (error) {
      toast.error("Gagal memperbarui anggaran")
    }
  }

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      toast.error("Data tidak ditemukan untuk periode ini")
      return
    }
    let csvContent = "Tanggal,Tipe,Kategori,Keterangan,Jumlah (Rp)\n"
    filteredTransactions.forEach(trx => {
      const date = new Date(trx.date).toLocaleDateString('id-ID')
      const type = trx.type === 'income' ? 'Pemasukan' : 'Pengeluaran'
      const category = trx.category?.name || '-'
      const description = `"${trx.description}"` 
      const amount = trx.amount
      csvContent += `${date},${type},${category},${description},${amount}\n`
    })
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `Laporan_Keuangan_${selectedMonth}_${selectedYear}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Laporan berhasil diunduh")
  }

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const trxDate = new Date(t.date)
      const isMatchMonth = (trxDate.getMonth() + 1) === Number(selectedMonth) && trxDate.getFullYear() === Number(selectedYear)
      const keyword = searchQuery.toLowerCase()
      const isMatchSearch = t.description.toLowerCase().includes(keyword) || (t.category?.name || '').toLowerCase().includes(keyword)
      return isMatchMonth && isMatchSearch
    })
  }, [transactions, selectedMonth, selectedYear, searchQuery])

  const summary = useMemo(() => {
    let income = 0; let expense = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'income') income += t.amount
      else expense += t.amount
    })
    return { income, expense, balance: income - expense }
  }, [filteredTransactions])

  const expenseData = useMemo(() => {
    return filteredTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => {
      const catName = curr.category?.name || 'Lainnya'
      const existing = acc.find(item => item.name === catName)
      if (existing) existing.value += curr.amount
      else acc.push({ name: catName, value: curr.amount })
      return acc
    }, [])
  }, [filteredTransactions])

  const budgetPercent = budget > 0 ? Math.min((summary.expense / budget) * 100, 100) : 0;
  const isOverBudget = summary.expense > budget && budget > 0;
  const isWarning = budgetPercent >= 80 && !isOverBudget;
  
  let barColor = 'bg-green-500';
  if (isOverBudget) barColor = 'bg-red-500';
  else if (isWarning) barColor = 'bg-amber-400';

  const availableCategories = categories.filter(cat => cat.type === formData.type)

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 flex items-center justify-center p-4 font-sans text-slate-800 dark:text-slate-100">
        <Toaster position="top-center" reverseOrder={false} />
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 max-w-md w-full transition-colors duration-300">
          <h1 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 text-center mb-2">Finance Tracker</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mb-8">{isLoginMode ? 'Masuk untuk mengelola keuangan Anda' : 'Buat akun baru secara gratis'}</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Email</label>
              <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} required className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Password</label>
              <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} required className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 dark:bg-indigo-500 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition">{isLoginMode ? 'Masuk' : 'Daftar'}</button>
          </form>
          <div className="text-center mt-6 flex justify-between items-center">
            <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">{isLoginMode ? 'Belum memiliki akun? Daftar' : 'Sudah memiliki akun? Masuk'}</button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100">
      <Toaster position="top-right" reverseOrder={false} />
      
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors duration-300">
          <div>
            <h1 className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">Finance Tracker</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Pengguna: {session.user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-amber-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition border border-slate-200 dark:border-slate-600">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-slate-50 dark:bg-slate-900 dark:text-white font-medium">
              {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 outline-none w-24 bg-slate-50 dark:bg-slate-900 dark:text-white font-medium text-center" />
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 border border-transparent dark:border-red-900/50 transition font-medium">
              <LogOut size={18} /> Keluar
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center"><TrendingUp size={28} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Pemasukan</p>
              <h3 className="text-2xl font-bold">Rp {summary.income.toLocaleString('id-ID')}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center"><TrendingDown size={28} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Pengeluaran</p>
              <h3 className="text-2xl font-bold">Rp {summary.expense.toLocaleString('id-ID')}</h3>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center"><Wallet size={28} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sisa Saldo</p>
              <h3 className="text-2xl font-bold">Rp {summary.balance.toLocaleString('id-ID')}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Target size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Anggaran Bulanan</h2>
                <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
                  {budget > 0 ? (
                    <>
                      <span>Terpakai Rp {summary.expense.toLocaleString('id-ID')} dari Rp {budget.toLocaleString('id-ID')}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isOverBudget ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' : isWarning ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                        {budgetPercent.toFixed(1)}%
                      </span>
                    </>
                  ) : (
                    <span>Target anggaran belum ditentukan untuk bulan ini.</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={() => { setEditBudgetAmount(budget || ''); setIsBudgetModalOpen(true); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold transition">
              {budget > 0 ? 'Sesuaikan Anggaran' : 'Atur Anggaran'}
            </button>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
            <div className={`h-4 transition-all duration-1000 ease-out ${barColor}`} style={{ width: `${budget > 0 ? budgetPercent : 0}%` }}></div>
          </div>
          <div className="flex justify-between mt-2 text-xs font-semibold">
            <span className="text-slate-400">0%</span>
            {isOverBudget ? <span className="text-red-500 animate-pulse">Pengeluaran melebihi batas anggaran</span> : isWarning ? <span className="text-amber-500">Mendekati batas anggaran</span> : <div></div>}
            <span className="text-slate-400">100%</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 h-fit transition-colors">
            <h2 className="text-xl font-semibold mb-4">{editingId ? 'Edit Transaksi' : 'Tambah Transaksi'}</h2>
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Tanggal</label>
                <input type="date" name="date" value={formData.date} max={getTodayDate()} onChange={(e) => setFormData({...formData, date: e.target.value})} required className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 dark:bg-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Tipe</label>
                <select name="type" value={formData.type} onChange={(e) => {
                    const newType = e.target.value
                    const newAvailableCats = categories.filter(c => c.type === newType)
                    setFormData({...formData, type: newType, categoryId: newAvailableCats.length > 0 ? newAvailableCats[0].id : ''})
                  }} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 dark:bg-slate-900 dark:text-white">
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Kategori</label>
                <div className="flex gap-2">
                  <select name="categoryId" value={formData.categoryId} onChange={(e) => setFormData({...formData, categoryId: e.target.value})} className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 dark:bg-slate-900 dark:text-white">
                    {availableCategories.length === 0 && <option value="">Tidak ada kategori</option>}
                    {availableCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                  <button type="button" onClick={() => { setNewCategoryName(''); setIsCategoryModalOpen(true); }} className="bg-slate-200 dark:bg-slate-700 px-4 rounded-lg font-bold hover:bg-slate-300 transition text-slate-800 dark:text-white">+</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Jumlah (Rp)</label>
                <input type="number" name="amount" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} required className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 dark:bg-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-300">Keterangan</label>
                <input type="text" name="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 dark:bg-slate-900 dark:text-white" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 dark:bg-indigo-500 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition">Simpan Data</button>
            </form>
          </div>

          <div className="col-span-1 lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <h2 className="text-xl font-semibold mb-4">Statistik Pengeluaran</h2>
              {expenseData.length > 0 ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {expenseData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} contentStyle={{ backgroundColor: isDarkMode ? '#1e293b' : '#fff', color: isDarkMode ? '#fff' : '#000', borderRadius: '8px', border: 'none' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <div className="h-72 flex items-center justify-center text-slate-400">Tidak ada data untuk periode ini</div>}
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-3">
                <h2 className="text-xl font-semibold">Riwayat Transaksi</h2>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <input type="text" placeholder="Cari transaksi..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full sm:w-64 border border-slate-200 dark:border-slate-600 rounded-lg pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 dark:bg-slate-900 text-sm" />
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  </div>
                  <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 rounded-lg text-sm font-semibold transition border border-emerald-200 dark:border-emerald-800">
                    <Download size={16} /> Export CSV
                  </button>
                </div>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {filteredTransactions.length > 0 ? filteredTransactions.map((trx) => (
                    <div key={trx.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:shadow-md transition">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex shrink-0 items-center justify-center text-xl ${trx.type === 'income' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                          {trx.type === 'income' ? '↓' : '↑'}
                        </div>
                        <div>
                          <h4 className="font-semibold">{trx.description}</h4>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{trx.category?.name} • {new Date(trx.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 mt-2 sm:mt-0 ml-16 sm:ml-0">
                        <div className={`font-bold ${trx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                          {trx.type === 'income' ? '+' : '-'} Rp {trx.amount.toLocaleString('id-ID')}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => {
                            setEditingId(trx.id); setFormData({ amount: trx.amount, type: trx.type, description: trx.description, categoryId: trx.categoryId, date: trx.date.split('T')[0] })
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }} className="p-2 text-slate-400 hover:text-amber-500 rounded-lg"><Edit2 size={18} /></button>
                          <button onClick={() => handleDelete(trx.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg"><Trash2 size={18} /></button>
                        </div>
                      </div>
                    </div>
                  )) : <p className="text-slate-500 text-center py-8">Tidak ada transaksi pada periode ini</p>}
              </div>
            </div>
          </div>
        </div>

        {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="text-lg font-bold mb-4">Tambah Kategori {formData.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</h3>
              <form onSubmit={submitNewCategory}>
                <input type="text" autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Nama kategori" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-3 outline-none mb-6 bg-slate-50 dark:bg-slate-900" required />
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Batal</button>
                  <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isBudgetModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl">
              <h3 className="text-lg font-bold mb-2">Target Anggaran</h3>
              <p className="text-sm text-slate-500 mb-4">Tentukan batas maksimal pengeluaran bulanan Anda.</p>
              <form onSubmit={submitNewBudget}>
                <input type="number" autoFocus value={editBudgetAmount} onChange={(e) => setEditBudgetAmount(e.target.value)} placeholder="Contoh: 5000000" className="w-full border border-slate-200 dark:border-slate-600 rounded-lg p-3 outline-none mb-6 bg-slate-50 dark:bg-slate-900" required />
                <div className="flex gap-3 justify-end">
                  <button type="button" onClick={() => setIsBudgetModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Batal</button>
                  <button type="submit" className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">Simpan</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App