'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/store/authStore';
import { cardsAPI } from '@/app/api/cards';
import toast from 'react-hot-toast';
import Layout from '@/components/Layout';

// بيانات تجريبية لـ 12 بطاقة
const dummyCards = [
  {
    card_name: 'Emirates NBD Infinite',
    bank_name: 'Emirates NBD',
    card_number: '4532123456789012',
    cardholder_name: 'Ahmed Mohammed Al Mansoori',
    cvv: '123',
    expiry_month: 12,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 50000,
    current_balance: 12500,
    balance_currency: 'AED',
    statement_date: 15,
    payment_due_date: 25,
    minimum_payment: 500,
  },
  {
    card_name: 'ADCB Platinum',
    bank_name: 'Abu Dhabi Commercial Bank',
    card_number: '5123456789012345',
    cardholder_name: 'Fatima Ali Al Zaabi',
    cvv: '456',
    expiry_month: 8,
    expiry_year: 2026,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 75000,
    current_balance: 32000,
    balance_currency: 'AED',
    statement_date: 10,
    payment_due_date: 20,
    minimum_payment: 800,
  },
  {
    card_name: 'FAB World Elite',
    bank_name: 'First Abu Dhabi Bank',
    card_number: '4000123456789010',
    cardholder_name: 'Mohammed Khalid Al Suwaidi',
    cvv: '789',
    expiry_month: 6,
    expiry_year: 2028,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 100000,
    current_balance: 45000,
    balance_currency: 'AED',
    statement_date: 5,
    payment_due_date: 15,
    minimum_payment: 1200,
  },
  {
    card_name: 'DIB Signature',
    bank_name: 'Dubai Islamic Bank',
    card_number: '5555123456789012',
    cardholder_name: 'Sara Ibrahim Al Maktoum',
    cvv: '234',
    expiry_month: 3,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 60000,
    current_balance: 18000,
    balance_currency: 'AED',
    statement_date: 20,
    payment_due_date: 30,
    minimum_payment: 600,
  },
  {
    card_name: 'HSBC Premier',
    bank_name: 'HSBC Bank',
    card_number: '4111111111111111',
    cardholder_name: 'Omar Hassan Al Shamsi',
    cvv: '567',
    expiry_month: 11,
    expiry_year: 2026,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 80000,
    current_balance: 28000,
    balance_currency: 'AED',
    statement_date: 12,
    payment_due_date: 22,
    minimum_payment: 900,
  },
  {
    card_name: 'RAK Bank Titanium',
    bank_name: 'RAK Bank',
    card_number: '5424000000000015',
    cardholder_name: 'Layla Abdullah Al Nuaimi',
    cvv: '890',
    expiry_month: 9,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 45000,
    current_balance: 9500,
    balance_currency: 'AED',
    statement_date: 18,
    payment_due_date: 28,
    minimum_payment: 400,
  },
  {
    card_name: 'Mashreq Gold',
    bank_name: 'Mashreq Bank',
    card_number: '4242424242424242',
    cardholder_name: 'Khalid Saif Al Dhaheri',
    cvv: '345',
    expiry_month: 4,
    expiry_year: 2028,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 55000,
    current_balance: 22000,
    balance_currency: 'AED',
    statement_date: 8,
    payment_due_date: 18,
    minimum_payment: 550,
  },
  {
    card_name: 'Standard Chartered Platinum',
    bank_name: 'Standard Chartered',
    card_number: '5105105105105100',
    cardholder_name: 'Noor Mohammed Al Qasimi',
    cvv: '678',
    expiry_month: 7,
    expiry_year: 2026,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 70000,
    current_balance: 35000,
    balance_currency: 'AED',
    statement_date: 14,
    payment_due_date: 24,
    minimum_payment: 850,
  },
  {
    card_name: 'ENBD Skywards',
    bank_name: 'Emirates NBD',
    card_number: '4000000000000002',
    cardholder_name: 'Youssef Hamad Al Falasi',
    cvv: '901',
    expiry_month: 2,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 65000,
    current_balance: 15000,
    balance_currency: 'AED',
    statement_date: 22,
    payment_due_date: 2,
    minimum_payment: 650,
  },
  {
    card_name: 'ADCB Cashback',
    bank_name: 'Abu Dhabi Commercial Bank',
    card_number: '5555555555554444',
    cardholder_name: 'Mariam Salem Al Ameri',
    cvv: '234',
    expiry_month: 10,
    expiry_year: 2028,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 40000,
    current_balance: 12000,
    balance_currency: 'AED',
    statement_date: 16,
    payment_due_date: 26,
    minimum_payment: 450,
  },
  {
    card_name: 'FAB Rewards',
    bank_name: 'First Abu Dhabi Bank',
    card_number: '4012888888881881',
    cardholder_name: 'Hamdan Rashid Al Mazrouei',
    cvv: '567',
    expiry_month: 5,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 50000,
    current_balance: 19500,
    balance_currency: 'AED',
    statement_date: 11,
    payment_due_date: 21,
    minimum_payment: 500,
  },
  {
    card_name: 'DIB Platinum',
    bank_name: 'Dubai Islamic Bank',
    card_number: '5200828282828210',
    cardholder_name: 'Aisha Nasser Al Ketbi',
    cvv: '890',
    expiry_month: 1,
    expiry_year: 2028,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 85000,
    current_balance: 42000,
    balance_currency: 'AED',
    statement_date: 7,
    payment_due_date: 17,
    minimum_payment: 1000,
  },
];

export default function SeedCardsPage() {
  const router = useRouter();
  const { isAuthenticated, loadUser, isLoading } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [started, setStarted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const isProd = process.env.NODE_ENV !== 'development';

  // Block in production — redirect and disable all logic
  useEffect(() => {
    if (isProd) router.replace('/dashboard');
  }, [isProd, router]);

  // تحميل حالة المستخدم عند فتح الصفحة
  useEffect(() => {
    if (isProd) return;
    const checkAuth = async () => {
      try {
        await loadUser();
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, [isProd, loadUser]);

  const handleSeedCards = useCallback(async () => {
    if (!isAuthenticated) {
      toast.error('يجب تسجيل الدخول أولاً');
      router.push('/login');
      return;
    }

    setLoading(true);
    setStarted(true);
    setProgress({ current: 0, total: dummyCards.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < dummyCards.length; i++) {
      const card = dummyCards[i];
      setProgress({ current: i + 1, total: dummyCards.length });

      try {
        await cardsAPI.create(card as any);
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err: any) {
        console.error(`Error creating card ${i + 1}:`, err);
        errorCount++;
      }
    }

    setLoading(false);

    if (successCount > 0) {
      toast.success(`تم إضافة ${successCount} بطاقة بنجاح!`);
      setTimeout(() => {
        router.push('/cards');
      }, 2000);
    }

    if (errorCount > 0) {
      toast.error(`فشل إضافة ${errorCount} بطاقة`);
    }
  }, [router, isAuthenticated]);

  // إضافة تلقائية عند فتح الصفحة بعد التأكد من المصادقة
  useEffect(() => {
    if (isProd) return;
    if (!checkingAuth && isAuthenticated && !started && !loading) {
      handleSeedCards();
    }
  }, [isProd, checkingAuth, isAuthenticated, started, loading, handleSeedCards]);

  if (isProd) return null;

  // عرض حالة التحميل
  if (checkingAuth || isLoading) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>جاري التحقق من تسجيل الدخول...</p>
        </div>
      </Layout>
    );
  }

  // إذا لم يكن مسجل دخول
  if (!isAuthenticated) {
    return (
      <Layout>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ marginBottom: '1rem' }}>يجب تسجيل الدخول أولاً</p>
          <button 
            onClick={() => router.push('/login')} 
            className="btn btn-primary"
          >
            تسجيل الدخول
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '1rem' }}>إضافة بطاقات تجريبية</h1>
        <p style={{ marginBottom: '2rem', color: 'var(--text-secondary)' }}>
          سيتم إضافة {dummyCards.length} بطاقة ائتمان تجريبية ببيانات كاملة
        </p>

        {loading && (
          <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
            <p>جاري الإضافة... {progress.current} / {progress.total}</p>
            <div style={{ 
              width: '100%', 
              height: '8px', 
              background: 'var(--border)', 
              borderRadius: 'var(--radius)',
              marginTop: '0.5rem',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(progress.current / progress.total) * 100}%`,
                height: '100%',
                background: 'var(--primary)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        )}

        {!started && (
          <button
            onClick={handleSeedCards}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.75rem 1.5rem' }}
          >
            {loading ? 'جاري الإضافة...' : `إضافة ${dummyCards.length} بطاقة تجريبية`}
          </button>
        )}

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>البطاقات التي سيتم إضافتها:</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {dummyCards.map((card, index) => (
              <li key={index} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <strong>{card.card_name}</strong> - {card.bank_name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
