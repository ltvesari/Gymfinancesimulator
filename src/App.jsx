import React, { useState, useEffect } from 'react';
import './index.css';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
};

function App() {
    const [activeTab, setActiveTab] = useState('input'); // input | result

    // 1. Aylık Giderler (Monthly Expenses)
    const [expenses, setExpenses] = useState({
        staffFixedCost: 40214.03, // Maaşlı çalışan sabit maliyeti
        staffPerLesson: 150, // Maaşlı çalışan ders başı kazancı (default guess)
        freelancePercentage: 40, // Freelancer yüzdesi
        rent: 20000,
        electricity: 3000,
        water: 1000,
        gas: 1500,
        amenities: 2000, // İkram
        cleaning: 3000,
        subscriptions: 1000, // Dijital abonelikler
        accountant: 2000
    });

    // 2. Kuruluma Özel Giderler (Startup Costs)
    const [startupCosts, setStartupCosts] = useState({
        architecture: 200000,
        equipment: 500000,
        fixtures: 100000
    });

    // 3. Gelirler (Income)
    const [income, setIncome] = useState({
        packagePrice: 10000,
        // totalMonthlySales removed, calculated dynamically
        cashRatio: 50, // %50 cash, %50 card
        posRate: 2.5
    });

    // 4. Hocalar (Trainers)
    const [trainers, setTrainers] = useState([
        { id: 1, name: 'Hoca 1', type: 'salary', studentCount: 10, monthlyLessons: 40, cancelRate: 1 }
    ]);

    // Simulation
    const [simulationMonths, setSimulationMonths] = useState(12);
    const [startMonth, setStartMonth] = useState(1); // 1 = Ocak
    const [results, setResults] = useState(null);

    const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    const addTrainer = () => {
        setTrainers([...trainers, {
            id: Date.now(),
            name: `Hoca ${trainers.length + 1}`,
            type: 'freelance',
            studentCount: 5,
            monthlyLessons: 20,
            cancelRate: 1
        }]);
    };

    const removeTrainer = (id) => {
        setTrainers(trainers.filter(t => t.id !== id));
    };

    const updateTrainer = (id, field, value) => {
        setTrainers(trainers.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    // Helper to estimate current packages based on active trainers
    const calculateEstimatedPackages = () => {
        const totalLessons = trainers.reduce((acc, t) => {
            const realized = Math.max(0, Number(t.monthlyLessons) - (Number(t.cancelRate) * 4));
            return acc + realized;
        }, 0);
        return Math.ceil(totalLessons / 10); // Round up or keep decimal? Let's keep decimal for financial precision, but ceil for UI.
    };

    // Helper for Income Tax (2026 Brackets)
    const calculateIncomeTax = (cumulativeProfit) => {
        if (cumulativeProfit <= 0) return 0;

        let tax = 0;
        // Tier 1: 0 - 190.000 @ 15%
        if (cumulativeProfit <= 190000) {
            return cumulativeProfit * 0.15;
        }
        tax += 190000 * 0.15; // 28.500

        // Tier 2: 190.000 - 400.000 @ 20%
        if (cumulativeProfit <= 400000) {
            return tax + (cumulativeProfit - 190000) * 0.20;
        }
        tax += (400000 - 190000) * 0.20; // + 42.000 = 70.500

        // Tier 3: 400.000 - 1.000.000 @ 27%
        if (cumulativeProfit <= 1000000) {
            return tax + (cumulativeProfit - 400000) * 0.27;
        }
        tax += (1000000 - 400000) * 0.27; // + 162.000 = 232.500

        // Tier 4: 1.000.000 - 5.300.000 @ 35%
        if (cumulativeProfit <= 5300000) {
            return tax + (cumulativeProfit - 1000000) * 0.35;
        }
        tax += (5300000 - 1000000) * 0.35; // + 1.505.000 = 1.737.500

        // Tier 5: > 5.300.000 @ 40%
        return tax + (cumulativeProfit - 5300000) * 0.40;
    };

    const calculateSimulation = () => {
        const monthlyData = [];
        let totalStartup = Number(startupCosts.architecture) + Number(startupCosts.equipment) + Number(startupCosts.fixtures);
        let cumulativeBalance = -totalStartup;

        // Annual Tax Tracking
        let yearlyOfficialProfit = 0; // Cumulative profit for current calendar year
        let totalTaxAccrued = 0;

        // Detailed Finanical Tracking
        let totalGrossCashRevenue = 0;
        let totalGrossCardRevenue = 0;
        let totalVAT = 0;
        let totalPOS = 0;
        let totalFixedExpenses = 0;
        let totalTrainerExpenses = 0;

        let currentCalendarMonth = Number(startMonth);

        for (let i = 1; i <= simulationMonths; i++) {
            // --- Calculate Volume from Trainers ---
            let totalRealizedLessons = 0;
            let currentMonthTrainerCost = 0;
            const price = Number(income.packagePrice);

            trainers.forEach(t => {
                const realizedLessons = Math.max(0, Number(t.monthlyLessons) - (Number(t.cancelRate) * 4));
                totalRealizedLessons += realizedLessons;

                if (t.type === 'salary') {
                    currentMonthTrainerCost += realizedLessons * Number(expenses.staffPerLesson);
                } else if (t.type === 'freelance') {
                    const lessonPrice = price / 10;
                    const trainerShare = lessonPrice * (expenses.freelancePercentage / 100);
                    currentMonthTrainerCost += realizedLessons * trainerShare;
                } else if (t.type === 'owner') {
                    currentMonthTrainerCost += 11725.65;
                }
            });

            // --- Revenue Calculation ---
            const totalSales = totalRealizedLessons / 10;
            // Split Total Sales based on Cash Ratio
            const cashCount = totalSales * (income.cashRatio / 100);
            const cardCount = totalSales * ((100 - income.cashRatio) / 100);

            // Cash Sales (10% discount)
            const cashRevenue = cashCount * (price * 0.90);

            // Card Sales
            // Gross Card Revenue (includes VAT)
            const grossCardRevenue = cardCount * price;

            // VAT Calculation (Price includes 20% VAT)
            const vatAmount = grossCardRevenue - (grossCardRevenue / 1.20);

            // POS Commission (Applied on Gross Amount)
            const posCommissionAmount = grossCardRevenue * (income.posRate / 100);

            // Net Card Inflow
            const netCardInflow = grossCardRevenue - vatAmount - posCommissionAmount;

            const totalMonthlyRevenue = cashRevenue + netCardInflow;

            // --- Fixed Costs ---
            const rentCost = Number(expenses.rent) * 1.20;
            const currentMonthFixedCosts =
                Number(expenses.staffFixedCost) +
                rentCost +
                Number(expenses.electricity) +
                Number(expenses.water) +
                Number(expenses.gas) +
                Number(expenses.amenities) +
                Number(expenses.cleaning) +
                Number(expenses.subscriptions) +
                Number(expenses.accountant);

            const totalMonthlyExpenses = currentMonthFixedCosts + currentMonthTrainerCost;

            // --- Accumulate Totals ---
            totalGrossCashRevenue += cashRevenue;
            totalGrossCardRevenue += grossCardRevenue;
            totalVAT += vatAmount;
            totalPOS += posCommissionAmount;
            totalFixedExpenses += currentMonthFixedCosts;
            totalTrainerExpenses += currentMonthTrainerCost;

            // --- Profit Accumulation for Tax ---
            const officialRevenueForTax = (grossCardRevenue - vatAmount);
            const currentMonthOfficialProfit = officialRevenueForTax - totalMonthlyExpenses;

            yearlyOfficialProfit += currentMonthOfficialProfit;

            // --- Tax Calculation (December Check) ---
            let monthlyTax = 0;
            if (currentCalendarMonth === 12) {
                const taxBase = Math.max(0, yearlyOfficialProfit);
                monthlyTax = calculateIncomeTax(taxBase);
                totalTaxAccrued += monthlyTax;
                yearlyOfficialProfit = 0;
            }

            // --- Net Profit (Cash Flow) ---
            const netMonthlyProfit = totalMonthlyRevenue - totalMonthlyExpenses - monthlyTax;

            cumulativeBalance += netMonthlyProfit;

            monthlyData.push({
                month: i,
                calendarMonthName: months[currentCalendarMonth - 1],
                revenue: totalMonthlyRevenue,
                expenses: totalMonthlyExpenses,
                vat: vatAmount,
                pos: posCommissionAmount,
                tax: monthlyTax,
                net: netMonthlyProfit,
                balance: cumulativeBalance,
                salesVolume: totalSales
            });

            // Increment Calendar Month
            currentCalendarMonth++;
            if (currentCalendarMonth > 12) currentCalendarMonth = 1;
        }

        setResults({
            monthlyData,
            finalBalance: cumulativeBalance,
            totalStartup,
            avgMonthlyRevenue: monthlyData.reduce((acc, curr) => acc + curr.revenue, 0) / simulationMonths,
            avgMonthlyNet: monthlyData.reduce((acc, curr) => acc + curr.net, 0) / simulationMonths,
            totalTax: totalTaxAccrued,
            // Detailed Breakdown Data
            breakdown: {
                grossCash: totalGrossCashRevenue,
                grossCard: totalGrossCardRevenue,
                vat: totalVAT,
                pos: totalPOS,
                fixedExpenses: totalFixedExpenses,
                trainerExpenses: totalTrainerExpenses,
                netRevenue: (totalGrossCashRevenue + totalGrossCardRevenue) - totalVAT - totalPOS,
                totalExpenses: totalFixedExpenses + totalTrainerExpenses
            }
        });

        // Auto scroll to results
        setTimeout(() => {
            document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    return (
        <div className="container">
            <h1>🏋️ Gym Finans Simülatörü</h1>

            <div className="grid-2">
                {/* 1. Monthly Expenses */}
                <div className="card">
                    <h2>💸 1. Aylık Sabit Giderler</h2>
                    <div className="form-group">
                        <label>Maaşlı Sabit Personel (Toplam)</label>
                        <input type="number" value={expenses.staffFixedCost} onChange={e => setExpenses({ ...expenses, staffFixedCost: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Maaşlı Hoca Ders Başı Prim (TL)</label>
                        <input type="number" value={expenses.staffPerLesson} onChange={e => setExpenses({ ...expenses, staffPerLesson: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Freelancer Hakediş Yüzdesi (%)</label>
                        <input type="number" value={expenses.freelancePercentage} onChange={e => setExpenses({ ...expenses, freelancePercentage: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Kira (Net)</label>
                        <input type="number" value={expenses.rent} onChange={e => setExpenses({ ...expenses, rent: e.target.value })} />
                        <small className="text-secondary">Stopaj (+%20) otomatik eklenecektir.</small>
                    </div>
                    <div className="grid-2">
                        <div className="form-group"><label>Elektrik</label><input type="number" value={expenses.electricity} onChange={e => setExpenses({ ...expenses, electricity: e.target.value })} /></div>
                        <div className="form-group"><label>Su</label><input type="number" value={expenses.water} onChange={e => setExpenses({ ...expenses, water: e.target.value })} /></div>
                    </div>
                    <div className="grid-2">
                        <div className="form-group"><label>Doğalgaz</label><input type="number" value={expenses.gas} onChange={e => setExpenses({ ...expenses, gas: e.target.value })} /></div>
                        <div className="form-group"><label>İkram & Sarf</label><input type="number" value={expenses.amenities} onChange={e => setExpenses({ ...expenses, amenities: e.target.value })} /></div>
                    </div>
                    <div className="grid-2">
                        <div className="form-group"><label>Temizlik</label><input type="number" value={expenses.cleaning} onChange={e => setExpenses({ ...expenses, cleaning: e.target.value })} /></div>
                        <div className="form-group"><label>Dijital Üyelikler</label><input type="number" value={expenses.subscriptions} onChange={e => setExpenses({ ...expenses, subscriptions: e.target.value })} /></div>
                    </div>
                    <div className="form-group">
                        <label>Muhasebe</label>
                        <input type="number" value={expenses.accountant} onChange={e => setExpenses({ ...expenses, accountant: e.target.value })} />
                    </div>
                </div>

                <div>
                    {/* 2. Startup Costs */}
                    <div className="card">
                        <h2>🏗️ 2. Kurulum Giderleri</h2>
                        <div className="form-group"><label>Mimari / Tadilat</label><input type="number" value={startupCosts.architecture} onChange={e => setStartupCosts({ ...startupCosts, architecture: e.target.value })} /></div>
                        <div className="form-group"><label>Makine & Alet</label><input type="number" value={startupCosts.equipment} onChange={e => setStartupCosts({ ...startupCosts, equipment: e.target.value })} /></div>
                        <div className="form-group"><label>Demirbaş (Mobilya/PC)</label><input type="number" value={startupCosts.fixtures} onChange={e => setStartupCosts({ ...startupCosts, fixtures: e.target.value })} /></div>
                    </div>

                    {/* 3. Income */}
                    <div className="card">
                        <h2>💰 3. Gelir Parametreleri</h2>
                        <div className="form-group">
                            <label>10'lu Ders Paketi Fiyatı (TL)</label>
                            <input type="number" value={income.packagePrice} onChange={e => setIncome({ ...income, packagePrice: e.target.value })} />
                        </div>

                        <div className="form-group" style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                            <label style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Otomatik Hesaplanan Paket Satışı</label>
                            <div className="stat-value">{calculateEstimatedPackages()} Adet / Ay</div>
                            <small className="text-secondary">Eğitmenlerin toplam ders yükü üzerinden hesaplanır. (10 Ders = 1 Paket)</small>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>💵 Nakit: %{income.cashRatio}</span>
                                <span>💳 Kart: %{100 - income.cashRatio}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={income.cashRatio}
                                onChange={e => setIncome({ ...income, cashRatio: Number(e.target.value) })}
                                style={{ width: '100%', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                <span>Daha çok Nakit</span>
                                <span>Daha çok Kart</span>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Kart POS Komisyonu (%)</label>
                            <input type="number" value={income.posRate} onChange={e => setIncome({ ...income, posRate: e.target.value })} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 4. Trainers */}
            <div className="card">
                <h2>👥 4. Eğitmen Kadrosu</h2>
                <div className="grid-3">
                    {trainers.map(trainer => {
                        const realizedLessons = Math.max(0, Number(trainer.monthlyLessons) - (Number(trainer.cancelRate) * 4));
                        let estimatedIncome = 0;
                        let incomeLabel = '';
                        let isCostNegative = false; // To show positive/negative color logic

                        if (trainer.type === 'salary') {
                            estimatedIncome = realizedLessons * Number(expenses.staffPerLesson);
                            incomeLabel = 'Ders Primi';
                        } else if (trainer.type === 'freelance') {
                            const lessonPrice = Number(income.packagePrice) / 10;
                            estimatedIncome = realizedLessons * lessonPrice * (expenses.freelancePercentage / 100);
                            incomeLabel = 'Hakediş';
                        } else if (trainer.type === 'owner') {
                            estimatedIncome = 11725.65;
                            incomeLabel = 'Bağkur Gideri';
                            isCostNegative = true; // It's a fixed cost
                        }

                        // Calculate generated revenue for display (nice to have)
                        // This is approximate since revenue depends on cash/card mix, but we can show Gross Revenue
                        // 10 lessons = 1 package.
                        const generatedPackages = realizedLessons / 10;
                        const grossRevenueGenerated = generatedPackages * Number(income.packagePrice);


                        return (
                            <div key={trainer.id} className="trainer-card" style={trainer.type === 'owner' ? { borderColor: 'var(--accent-color)', background: 'rgba(56, 189, 248, 0.1)' } : {}}>
                                <button className="btn-danger remove-trainer" onClick={() => removeTrainer(trainer.id)}>X</button>
                                <div className="form-group">
                                    <label>Eğitmen Adı {trainer.type === 'owner' && '👑'}</label>
                                    <input type="text" value={trainer.name} onChange={e => updateTrainer(trainer.id, 'name', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Çalışma Tipi</label>
                                    <select value={trainer.type} onChange={e => updateTrainer(trainer.id, 'type', e.target.value)}>
                                        <option value="salary">Maaşlı (+Prim)</option>
                                        <option value="freelance">Freelance (%Pay)</option>
                                        <option value="owner">İş Yeri Sahibi</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Aylık Ders Saati</label>
                                    <input type="number" value={trainer.monthlyLessons} onChange={e => updateTrainer(trainer.id, 'monthlyLessons', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Haftalık İptal Sayısı</label>
                                    <input type="number" value={trainer.cancelRate} onChange={e => updateTrainer(trainer.id, 'cancelRate', e.target.value)} />
                                </div>

                                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '0.5rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Salon Kazancı</div>
                                    <div style={{ fontSize: '1rem', color: 'var(--success-color)' }}>
                                        +{formatCurrency(grossRevenueGenerated)} <span style={{ fontSize: '0.7em' }}>(Brüt)</span>
                                    </div>

                                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                                        <div style={{ fontSize: '0.8rem', color: trainer.type === 'owner' ? 'var(--danger-color)' : 'var(--text-secondary)' }}>{incomeLabel}</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                            {formatCurrency(estimatedIncome)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button className="btn-add" onClick={addTrainer}>+ Eğitmen Ekle</button>
            </div>

            {/* Controls */}
            <div className="simulation-controls">
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label>Başlangıç:</label>
                    <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
                        {months.map((m, idx) => (
                            <option key={idx} value={idx + 1}>{m}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <label>Süre:</label>
                    <select value={simulationMonths} onChange={e => setSimulationMonths(Number(e.target.value))}>
                        <option value="6">6 Ay</option>
                        <option value="12">1 Yıl</option>
                        <option value="24">2 Yıl</option>
                        <option value="60">5 Yıl</option>
                    </select>
                </div>

                <button className="btn-primary" onClick={calculateSimulation}>
                    🚀 Simülasyonu Başlat
                </button>
            </div>

            {/* Results */}
            {results && (
                <div id="results-section" className="summary-section">
                    <h2>📈 Simülasyon Sonucu ({simulationMonths} Ay)</h2>

                    {/* Key Metrics */}
                    <div className="grid-2">
                        <div className="card">
                            <h3>İlk Kurulum Maliyeti</h3>
                            <div className="stat-value negative">{formatCurrency(results.totalStartup)}</div>
                        </div>
                        <div className="card">
                            <h3>Dönem Sonu Bakiye</h3>
                            <div className={`stat-value ${results.finalBalance >= 0 ? 'positive' : 'negative'}`}>
                                {formatCurrency(results.finalBalance)}
                            </div>
                            <small>{simulationMonths} ayın sonunda kâr/zarar durumu</small>
                        </div>
                    </div>

                    {/* Detailed Breakdown Table */}
                    <div className="card" style={{ marginTop: '2rem', padding: '0' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0 }}>📊 Detaylı Gelir/Gider Tablosu</h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Toplam {simulationMonths} Aylık Veri</span>
                        </div>
                        <div style={{ padding: '0' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <tbody>
                                    {/* Income Section */}
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}><td style={{ padding: '1rem', fontWeight: 'bold' }} colSpan="2">GELİRLER (BRÜT CİRO)</td></tr>
                                    <tr>
                                        <td style={{ padding: '0.75rem 1.5rem', color: 'var(--text-secondary)' }}>Nakit Satış Geliri</td>
                                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{formatCurrency(results.breakdown.grossCash)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '0.75rem 1.5rem', color: 'var(--text-secondary)' }}>Kredi Kartı Satış Geliri (Brüt)</td>
                                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right' }}>{formatCurrency(results.breakdown.grossCard)}</td>
                                    </tr>

                                    {/* Deductions */}
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}><td style={{ padding: '1rem', fontWeight: 'bold' }} colSpan="2">SATIŞ İNDİRİMLERİ (-)</td></tr>
                                    <tr>
                                        <td style={{ padding: '0.75rem 1.5rem', color: 'var(--danger-color)' }}>Ödenen KDV (%20)</td>
                                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', color: 'var(--danger-color)' }}>-{formatCurrency(results.breakdown.vat)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '0.75rem 1.5rem', color: 'var(--danger-color)' }}>POS Komisyonu</td>
                                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', color: 'var(--danger-color)' }}>-{formatCurrency(results.breakdown.pos)}</td>
                                    </tr>

                                    {/* Net Revenue */}
                                    <tr style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', background: 'rgba(34, 197, 94, 0.05)' }}>
                                        <td style={{ padding: '1rem 1.5rem', fontWeight: 'bold', color: 'var(--success-color)' }}>NET CİRO (Kasa Girişi)</td>
                                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--success-color)' }}>{formatCurrency(results.breakdown.netRevenue)}</td>
                                    </tr>

                                    {/* Expenses Section */}
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}><td style={{ padding: '1rem', fontWeight: 'bold' }} colSpan="2">GİDERLER (Faaliyet Giderleri) (-)</td></tr>
                                    <tr>
                                        <td style={{ padding: '0.75rem 1.5rem', color: 'var(--text-secondary)' }}>Sabit Giderler (Kira, Faturalar, Sabit Personel...)</td>
                                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>-{formatCurrency(results.breakdown.fixedExpenses)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '0.75rem 1.5rem', color: 'var(--text-secondary)' }}>Değişken Giderler (Eğitmen Prim/Hakediş)</td>
                                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>-{formatCurrency(results.breakdown.trainerExpenses)}</td>
                                    </tr>

                                    {/* Tax */}
                                    <tr style={{ background: 'rgba(255,255,255,0.02)' }}><td style={{ padding: '1rem', fontWeight: 'bold' }} colSpan="2">VERGİ (-)</td></tr>
                                    <tr>
                                        <td style={{ padding: '0.75rem 1.5rem', color: '#fbbf24' }}>Yıllık Gelir Vergisi</td>
                                        <td style={{ padding: '0.75rem 1.5rem', textAlign: 'right', color: '#fbbf24' }}>-{formatCurrency(results.totalTax)}</td>
                                    </tr>

                                    {/* Final Net Profit */}
                                    <tr style={{ background: 'var(--card-bg)', borderTop: '2px solid var(--border-color)' }}>
                                        <td style={{ padding: '1.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}>DÖNEM NET KÂRI</td>
                                        <td style={{ padding: '1.5rem', textAlign: 'right', fontSize: '1.5rem', fontWeight: 'bold', color: (results.breakdown.netRevenue - results.breakdown.totalExpenses - results.totalTax) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                            {formatCurrency(results.breakdown.netRevenue - results.breakdown.totalExpenses - results.totalTax)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem' }}>
                        <h3>Aylık Nakit Akış Tablosu</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '1rem' }}>Ay</th>
                                        <th style={{ padding: '1rem' }}>Net Gelir</th>
                                        <th style={{ padding: '1rem' }}>KDV (%20)</th>
                                        <th style={{ padding: '1rem' }}>Gider (Sabit+Hoca)</th>
                                        <th style={{ padding: '1rem' }}>Vergi</th>
                                        <th style={{ padding: '1rem' }}>Net (Aylık)</th>
                                        <th style={{ padding: '1rem' }}>Kümülatif Bakiye</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.monthlyData.map(d => (
                                        <tr key={d.month} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: d.tax > 0 ? 'rgba(251, 191, 36, 0.1)' : 'transparent' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <div>{d.month}. Ay</div>
                                                <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>{d.calendarMonthName}</div>
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--success-color)' }}>{formatCurrency(d.revenue)}</td>
                                            <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{formatCurrency(d.vat)}</td>
                                            <td style={{ padding: '1rem', color: 'var(--danger-color)' }}>{formatCurrency(d.expenses)}</td>
                                            <td style={{ padding: '1rem', color: '#fbbf24', fontWeight: d.tax > 0 ? 'bold' : 'normal' }}>
                                                {formatCurrency(d.tax)}
                                            </td>
                                            <td style={{ padding: '1rem', color: d.net >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                                {formatCurrency(d.net)}
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: 'bold' }}>{formatCurrency(d.balance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
