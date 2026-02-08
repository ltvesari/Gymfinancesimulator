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
        staffPerLesson: 150, // Maaşlı çalışan ders başı kazancı (PT)
        staffGroupLesson: 250, // Maaşlı çalışan grup dersi başı kazancı
        freelancePercentage: 40, // Freelancer yüzdesi (PT)
        freelanceGroupLesson: 250, // Freelancer grup dersi başı kazancı (Sabit Tutar)
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
        fixtures: 100000,
        reformerCount: 4, // Kaç adet reformer aleti alındığı
        reformerPrice: 60000 // Tane başı reformer fiyatı (Opsiyonel, equipment'a dahil değilse ekle)
    });

    // 3. Gelirler (Income)
    const [income, setIncome] = useState({
        packagePrice: 10000, // PT Paketi
        groupPackagePrice: 3000, // Grup Dersi Paketi
        avgClassSize: 5, // Ortalama grup dersi katılımcı sayısı

        // PT Ratios
        cashRatio: 50, // %50 cash, %50 card

        // Group Ratios
        groupCashRatio: 50, // %50 cash, %50 card for groups

        posRate: 2.5
    });

    // 4. Hocalar (Trainers)
    const [trainers, setTrainers] = useState([
        { id: 1, name: 'Hoca 1', type: 'salary', studentCount: 10, monthlyLessons: 40, monthlyGroupLessons: 0, cancelRate: 1 }
    ]);

    // Simulation
    const [simulationMonths, setSimulationMonths] = useState(12);
    const [startMonth, setStartMonth] = useState(1); // 1 = Ocak
    const [simulationMode, setSimulationMode] = useState('instant'); // 'instant' | 'interactive'
    const [currentStep, setCurrentStep] = useState(0); // 0 = not started, 1..N = months
    const [stepData, setStepData] = useState([]);
    const [cumulativeState, setCumulativeState] = useState({
        balance: 0,
        totalStartup: 0,
        yearlyOfficialProfit: 0, // For Tax
        totalTaxAccrued: 0,
        totalGrossCashRevenue: 0,
        totalGrossCardRevenue: 0,
        totalVAT: 0,
        totalPOS: 0,
        totalFixedExpenses: 0,
        totalTrainerExpenses: 0
    });

    const [monthAdjustments, setMonthAdjustments] = useState({
        volumePercent: 0,
        vacations: [], // array of trainer IDs
        extraExpense: 0
    });

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
            monthlyGroupLessons: 0,
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
        const ptLessons = trainers.reduce((acc, t) => {
            const realized = Math.max(0, Number(t.monthlyLessons) - (Number(t.cancelRate) * 4));
            return acc + realized;
        }, 0);
        return Math.ceil(ptLessons / 10);
    };

    const calculateEstimatedGroupPackages = () => {
        const groupLessons = trainers.reduce((acc, t) => acc + Number(t.monthlyGroupLessons), 0);
        // Her grup dersinde tüm reformerlar dolu varsayıyoruz (Kapasite)
        const capacity = Number(startupCosts.reformerCount);
        const totalVisits = groupLessons * capacity;
        return Math.ceil(totalVisits / 10);
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


    // --- Interactive Simulation Logic ---
    const startInteractiveSimulation = () => {
        setResults(null);
        setSimulationMode('interactive');
        setCurrentStep(1);
        setStepData([]);

        // Initial Cumulative State
        const rentStartupCost = (Number(expenses.rent) * 2) + (Number(expenses.rent) * 1);
        const totalStartup = Number(startupCosts.architecture) + Number(startupCosts.equipment) + Number(startupCosts.fixtures) + rentStartupCost;

        setCumulativeState({
            balance: -totalStartup,
            totalStartup: totalStartup,
            yearlyOfficialProfit: 0,
            totalTaxAccrued: 0,
            totalGrossCashRevenue: 0,
            totalGrossCardRevenue: 0,
            totalVAT: 0,
            totalPOS: 0,
            totalFixedExpenses: 0,
            totalTrainerExpenses: 0
        });

        // Reset adjustments
        setMonthAdjustments({
            volumePercent: 0,
            vacations: [],
            extraExpense: 0
        });
    };

    const runNextStep = () => {
        const i = currentStep;
        let currentCalendarMonth = Number(startMonth) + (i - 1);
        while (currentCalendarMonth > 12) currentCalendarMonth -= 12;

        let {
            balance, yearlyOfficialProfit, totalTaxAccrued,
            totalGrossCashRevenue, totalGrossCardRevenue, totalVAT, totalPOS, totalFixedExpenses, totalTrainerExpenses
        } = cumulativeState;

        // --- 1. Calculate Volume (with Adjustments) ---
        let totalRealizedLessons = 0;
        let totalGroupLessons = 0;
        let currentMonthTrainerCost = 0;
        const ptPrice = Number(income.packagePrice);
        const capacity = Number(startupCosts.reformerCount);

        trainers.forEach(t => {
            // Base Lessons
            let basePt = Math.max(0, Number(t.monthlyLessons) - (Number(t.cancelRate) * 4));
            let baseGroup = Number(t.monthlyGroupLessons || 0);

            // Apply Vacation (1 Week = 25% reduction for that month)
            if (monthAdjustments.vacations.includes(t.id)) {
                basePt = basePt * 0.75;
                baseGroup = baseGroup * 0.75;
            }

            // Apply Volume Adjustment (%)
            const factor = 1 + (Number(monthAdjustments.volumePercent) / 100);
            const finalPt = basePt * factor;
            const finalGroup = baseGroup * factor;

            totalRealizedLessons += finalPt;
            totalGroupLessons += finalGroup;

            // Cost Calculation
            if (t.type === 'salary') {
                currentMonthTrainerCost += (finalPt * Number(expenses.staffPerLesson)) + (finalGroup * Number(expenses.staffGroupLesson));
            } else if (t.type === 'freelance') {
                const ptLessonPrice = ptPrice / 10;
                const ptTrainerShare = ptLessonPrice * (expenses.freelancePercentage / 100);
                const groupTrainerShare = Number(expenses.freelanceGroupLesson);

                currentMonthTrainerCost += (finalPt * ptTrainerShare) + (finalGroup * groupTrainerShare);
            } else if (t.type === 'owner') {
                currentMonthTrainerCost += 11725.65;
            }
        });

        // --- 2. Revenue Calculation ---
        const totalPtSales = totalRealizedLessons / 10;
        const ptCashCount = totalPtSales * (income.cashRatio / 100);
        const ptCardCount = totalPtSales * ((100 - income.cashRatio) / 100);
        const ptCashRevenue = ptCashCount * (ptPrice * 0.90);
        const ptGrossCardRevenue = ptCardCount * ptPrice;

        const totalGroupVisits = totalGroupLessons * capacity;
        const totalGroupSales = totalGroupVisits / 10;
        const groupCashCount = totalGroupSales * (income.groupCashRatio / 100);
        const groupCardCount = totalGroupSales * ((100 - income.groupCashRatio) / 100);
        const groupPrice = Number(income.groupPackagePrice);
        const groupCashRevenue = groupCashCount * (groupPrice * 0.90);
        const groupGrossCardRevenue = groupCardCount * groupPrice;

        const totalCashRevenue = ptCashRevenue + groupCashRevenue;
        const totalGrossCardRevenueCombined = ptGrossCardRevenue + groupGrossCardRevenue;

        // VAT & POS
        const vatAmount = totalGrossCardRevenueCombined - (totalGrossCardRevenueCombined / 1.20);
        const posCommissionAmount = totalGrossCardRevenueCombined * (income.posRate / 100);
        const netCardInflow = totalGrossCardRevenueCombined - vatAmount - posCommissionAmount;

        const totalMonthlyRevenue = totalCashRevenue + netCardInflow;

        // --- 3. Fixed Costs + Extra ---
        const rentCost = Number(expenses.rent) / 0.80;
        let currentMonthFixedCosts =
            Number(expenses.staffFixedCost) +
            rentCost +
            Number(expenses.electricity) +
            Number(expenses.water) +
            Number(expenses.gas) +
            Number(expenses.amenities) +
            Number(expenses.cleaning) +
            Number(expenses.subscriptions) +
            Number(expenses.accountant);

        // Add User Defined Extra Expense
        currentMonthFixedCosts += Number(monthAdjustments.extraExpense);

        const totalMonthlyExpenses = currentMonthFixedCosts + currentMonthTrainerCost;

        // --- 4. Accumulate ---
        totalGrossCashRevenue += totalCashRevenue;
        totalGrossCardRevenue += totalGrossCardRevenueCombined;
        totalVAT += vatAmount;
        totalPOS += posCommissionAmount;
        totalFixedExpenses += currentMonthFixedCosts;
        totalTrainerExpenses += currentMonthTrainerCost;

        // Tax Logic (Monthly Estimated)
        const officialRevenueForTax = (totalGrossCardRevenueCombined - vatAmount);
        const currentMonthOfficialProfit = officialRevenueForTax - totalMonthlyExpenses;

        yearlyOfficialProfit += currentMonthOfficialProfit;

        // Her ay tahmini vergi düş (%20 Sabit Oran Varsayımı - Geçici Vergi Gibi)
        // Eğer o ay zarar ettiysek vergi 0.
        let monthlyTax = 0;
        if (currentMonthOfficialProfit > 0) {
            monthlyTax = currentMonthOfficialProfit * 0.20;
        }

        let taxDiscrepancy = 0;

        // --- Tax Adjustment Check (December) ---
        // Yıl sonunda sadece ne kadar şaştığını hesapla ama OTOMATİK DÜŞME.
        if (currentCalendarMonth === 12) {
            const actualYearlyTax = calculateIncomeTax(Math.max(0, yearlyOfficialProfit));
            const totalEstimatedTaxPaid = totalTaxAccrued + monthlyTax;

            // Fark: Gerçekleşen - Ödenen (Pozitifse Borç, Negatifse İade)
            taxDiscrepancy = actualYearlyTax - totalEstimatedTaxPaid;

            // Yıl bitti, sıfırla
            yearlyOfficialProfit = 0;
        }

        totalTaxAccrued += monthlyTax;

        // Net Profit
        const netMonthlyProfit = totalMonthlyRevenue - totalMonthlyExpenses - monthlyTax;
        balance += netMonthlyProfit;

        // Store Step Data
        const newData = {
            month: i,
            calendarMonthName: months[currentCalendarMonth - 1],
            revenue: totalMonthlyRevenue,
            expenses: totalMonthlyExpenses,
            vat: vatAmount,
            pos: posCommissionAmount,
            tax: monthlyTax,
            net: netMonthlyProfit,
            balance: balance,
            salesVolume: totalPtSales,
            groupVolume: totalGroupSales,
            adjustments: { ...monthAdjustments },
            taxDiscrepancy: taxDiscrepancy // Store discrepancy for display
        };
        const newStepData = [...stepData, newData];
        setStepData(newStepData);

        // Update Cumulative State
        setCumulativeState({
            balance, yearlyOfficialProfit, totalTaxAccrued, totalGrossCashRevenue, totalGrossCardRevenue,
            totalVAT, totalPOS, totalFixedExpenses, totalTrainerExpenses, totalStartup: cumulativeState.totalStartup
        });

        // Check if finished
        if (currentStep >= simulationMonths) {
            // FINISH
            setResults({
                monthlyData: newStepData,
                finalBalance: balance,
                totalStartup: cumulativeState.totalStartup,
                avgMonthlyRevenue: newStepData.reduce((acc, curr) => acc + curr.revenue, 0) / simulationMonths,
                avgMonthlyNet: newStepData.reduce((acc, curr) => acc + curr.net, 0) / simulationMonths,
                totalTax: totalTaxAccrued,
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
            setCurrentStep(0); // Ends interactive mode UI overlay
            setSimulationMode('instant'); // Show results
            setTimeout(() => {
                document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        } else {
            // ADVANCE
            setCurrentStep(currentStep + 1);
            // Reset Adjustments for next month (keep volume change if desired? no, reset for now as per "extra for that month")
            // Actually, keep volume change persistent? User said "bu ay totalde %X dersleri azaltı veya arttı". Implies transient.
            setMonthAdjustments({
                volumePercent: 0,
                vacations: [],
                extraExpense: 0
            });
        }
    };

    const toggleVacation = (id) => {
        const currentvacations = monthAdjustments.vacations;
        if (currentvacations.includes(id)) {
            setMonthAdjustments({ ...monthAdjustments, vacations: currentvacations.filter(v => v !== id) });
        } else {
            setMonthAdjustments({ ...monthAdjustments, vacations: [...currentvacations, id] });
        }
    };

    const calculateSimulation = () => {
        const monthlyData = [];

        // Startup Costs Calculation
        const rentStartupCost = (Number(expenses.rent) * 2) + (Number(expenses.rent) * 1); // 2 Depozito + 1 Emlakçı
        // Reformer Maliyeti (Eğer equipment kalemine dahil edilmediyse ayrıca ekliyoruz - opsiyonel, burada manuel ekliyse silebiliriz ama ayrı kalem olması iyi)
        // const reformerCost = Number(startupCosts.reformerCount) * Number(startupCosts.reformerPrice);

        let totalStartup = Number(startupCosts.architecture) + Number(startupCosts.equipment) + Number(startupCosts.fixtures) + rentStartupCost;

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
            // ... (previous logic) ...

            // --- Fixed Costs ---
            // Kira Stopajlı Hesaplama: Net / 0.80 = Brüt Kira Gideri
            const rentCost = Number(expenses.rent) / 0.80;
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
            totalGrossCashRevenue += totalCashRevenue;
            totalGrossCardRevenue += totalGrossCardRevenueCombined;
            totalVAT += vatAmount;
            totalPOS += posCommissionAmount;
            totalFixedExpenses += currentMonthFixedCosts;
            totalTrainerExpenses += currentMonthTrainerCost;


            // --- Profit Accumulation for Tax ---
            const officialRevenueForTax = (totalGrossCardRevenueCombined - vatAmount);
            const currentMonthOfficialProfit = officialRevenueForTax - totalMonthlyExpenses;

            yearlyOfficialProfit += currentMonthOfficialProfit;

            // Her ay tahmini vergi düş (%20 Sabit Oran Varsayımı - Geçici Vergi Gibi)
            let monthlyTax = 0;
            if (currentMonthOfficialProfit > 0) {
                monthlyTax = currentMonthOfficialProfit * 0.20;
            }

            let taxDiscrepancy = 0;

            // --- Tax Adjustment Check (December) ---
            if (currentCalendarMonth === 12) {
                const actualYearlyTax = calculateIncomeTax(Math.max(0, yearlyOfficialProfit));
                // Şu ana kadar biriken + bu ayın tahmini = Yıl sonu toplam ödenmiş olacak olan
                const totalEstimatedTaxPaid = totalTaxAccrued + monthlyTax;

                taxDiscrepancy = actualYearlyTax - totalEstimatedTaxPaid;

                yearlyOfficialProfit = 0;
            }

            totalTaxAccrued += monthlyTax;

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
                salesVolume: totalPtSales,
                groupVolume: totalGroupSales,
                taxDiscrepancy: taxDiscrepancy
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
                    <div className="grid-2">
                        <div className="form-group"><label>Maaşlı Hoca PT Primi (TL)</label><input type="number" value={expenses.staffPerLesson} onChange={e => setExpenses({ ...expenses, staffPerLesson: e.target.value })} /></div>
                        <div className="form-group"><label>Maaşlı Hoca Grup Ücreti</label><input type="number" value={expenses.staffGroupLesson} onChange={e => setExpenses({ ...expenses, staffGroupLesson: e.target.value })} /></div>
                    </div>

                    <div className="grid-2">
                        <div className="form-group"><label>Freelance PT Oranı (%)</label><input type="number" value={expenses.freelancePercentage} onChange={e => setExpenses({ ...expenses, freelancePercentage: e.target.value })} /></div>
                        <div className="form-group"><label>Freelance Grup Ücreti (TL)</label><input type="number" value={expenses.freelanceGroupLesson} onChange={e => setExpenses({ ...expenses, freelanceGroupLesson: e.target.value })} /></div>
                    </div>
                    <div className="form-group">
                        <label>Kira (Net)</label>
                        <input type="number" value={expenses.rent} onChange={e => setExpenses({ ...expenses, rent: e.target.value })} />
                        <small className="text-secondary">Stopaj (Net / 0.80) formülüyle brütleştirilip gider yazılacaktır.</small>
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

                        <div className="form-group" style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '0.75rem', borderRadius: '0.25rem', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                            <label style={{ color: '#fbbf24', fontSize: '0.9rem' }}>Kira Giderleri (Depozito + Komisyon)</label>
                            <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {formatCurrency(Number(expenses.rent) * 3)}
                            </div>
                            <small className="text-secondary" style={{ display: 'block', marginTop: '0.25rem' }}>
                                2 Kira Depozito: {formatCurrency(Number(expenses.rent) * 2)} <br />
                                1 Kira Emlakçı: {formatCurrency(Number(expenses.rent) * 1)}
                            </small>
                        </div>
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

                        <hr style={{ margin: '20px 0', borderColor: 'var(--border-color)' }} />

                        <h3>🏋️‍♀️ Grup Dersleri</h3>
                        <div className="grid-2">
                            <div className="form-group">
                                <label>Grup Paketi Fiyatı (10'lu)</label>
                                <input type="number" value={income.groupPackagePrice} onChange={e => setIncome({ ...income, groupPackagePrice: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Ort. Doluluk (Kişi)</label>
                                <div style={{ padding: '0.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '0.25rem' }}>
                                    {startupCosts.reformerCount} Kişi (Full)
                                </div>
                                <small className="text-secondary">Reformer sayısına göre sabitlendi.</small>
                            </div>
                        </div>

                        <div className="form-group" style={{ background: 'rgba(124, 58, 237, 0.1)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
                            <label style={{ color: '#c084fc', fontWeight: 'bold' }}>Tahmini Grup Paket Satışı</label>
                            <div className="stat-value">{calculateEstimatedGroupPackages()} Adet / Ay</div>
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>💵 Nakit: %{income.groupCashRatio}</span>
                                <span>💳 Kart: %{100 - income.groupCashRatio}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="10"
                                value={income.groupCashRatio}
                                onChange={e => setIncome({ ...income, groupCashRatio: Number(e.target.value) })}
                                style={{ width: '100%', cursor: 'pointer', accentColor: '#c084fc' }}
                            />
                        </div>

                        <hr style={{ margin: '20px 0', borderColor: 'var(--border-color)' }} />

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
                        // let isCostNegative = false; // Unused for now

                        // Group Lesson Calculation for Trainer
                        const groupLessons = Number(trainer.monthlyGroupLessons || 0);
                        let groupEarnings = 0;

                        if (trainer.type === 'salary') {
                            estimatedIncome = realizedLessons * Number(expenses.staffPerLesson);
                            groupEarnings = groupLessons * Number(expenses.staffGroupLesson);
                            estimatedIncome += groupEarnings;
                            incomeLabel = 'Toplam Prim';
                        } else if (trainer.type === 'freelance') {
                            const lessonPrice = Number(income.packagePrice) / 10;
                            estimatedIncome = realizedLessons * lessonPrice * (expenses.freelancePercentage / 100);

                            // Freelance group usually fixed fee
                            groupEarnings = groupLessons * Number(expenses.freelanceGroupLesson);
                            estimatedIncome += groupEarnings;

                            incomeLabel = 'Toplam Hakediş';
                        } else if (trainer.type === 'owner') {
                            estimatedIncome = 11725.65;
                            incomeLabel = 'Bağkur Gideri';
                        }

                        // Calculate generated revenue for display (nice to have)
                        const generatedPackages = realizedLessons / 10;
                        const grossRevenueGenerated = generatedPackages * Number(income.packagePrice);

                        // Group Revenue Generated (Approx)
                        // Hoca 1 saat grup dersi verince, Reformer Sayısı kadar öğrenci geliri yazar.
                        const capacity = Number(startupCosts.reformerCount);
                        const groupRevenueGenerated = (groupLessons * capacity / 10) * Number(income.groupPackagePrice);
                        const totalGrossGenerated = grossRevenueGenerated + groupRevenueGenerated;

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
                                    <label>Aylık PT Ders (Saat)</label>
                                    <input type="number" value={trainer.monthlyLessons} onChange={e => updateTrainer(trainer.id, 'monthlyLessons', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Aylık Grup Dersi (Saat)</label>
                                    <input type="number" value={trainer.monthlyGroupLessons} onChange={e => updateTrainer(trainer.id, 'monthlyGroupLessons', e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label>Haftalık İptal</label>
                                    <input type="number" value={trainer.cancelRate} onChange={e => updateTrainer(trainer.id, 'cancelRate', e.target.value)} />
                                </div>

                                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '0.5rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Salon Kazancı (Tahmini)</div>
                                    <div style={{ fontSize: '1rem', color: 'var(--success-color)' }}>
                                        +{formatCurrency(totalGrossGenerated)} <span style={{ fontSize: '0.7em' }}>(Brüt)</span>
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
                    🚀 Simülasyonu Başlat (Hızlı)
                </button>
                <button className="btn-primary" style={{ background: 'var(--accent-color)' }} onClick={startInteractiveSimulation}>
                    ▶️ Simülasyonu İŞLET (Adım Adım)
                </button>
            </div>

            {/* Interactive Mode Dashboard */}
            {simulationMode === 'interactive' && currentStep > 0 && (
                <div className="card" style={{ border: '2px solid var(--accent-color)', background: 'rgba(14, 165, 233, 0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ margin: 0, color: 'var(--accent-color)' }}>
                            🗓️ {currentStep}. Ay İşlemleri ({months[(Number(startMonth) + (currentStep - 2)) % 12 || (Number(startMonth) + 11) % 12]})
                        </h2>
                        <div className="stat-value" style={{ fontSize: '1rem' }}>
                            Kasa: {formatCurrency(cumulativeState.balance)}
                        </div>
                    </div>

                    <div className="grid-2">
                        {/* Volume Control */}
                        <div className="form-group" style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.5rem' }}>
                            <label>📊 İş Hacmi (Ders Yoğunluğu)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <input
                                    type="range" min="-50" max="50" step="10"
                                    value={monthAdjustments.volumePercent}
                                    onChange={e => setMonthAdjustments({ ...monthAdjustments, volumePercent: e.target.value })}
                                />
                                <span style={{ fontWeight: 'bold', color: monthAdjustments.volumePercent > 0 ? 'var(--success-color)' : monthAdjustments.volumePercent < 0 ? 'var(--danger-color)' : 'inherit' }}>
                                    %{monthAdjustments.volumePercent > 0 ? '+' : ''}{monthAdjustments.volumePercent}
                                </span>
                            </div>
                            <small className="text-secondary">Bu ay tüm dersler bu oranda artacak/azalacak.</small>
                        </div>

                        {/* Extra Expense */}
                        <div className="form-group" style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '0.5rem' }}>
                            <label>💸 Bu Ay Ekstra Gider</label>
                            <input
                                type="number"
                                placeholder="Örn: Tamirat, Reklam..."
                                value={monthAdjustments.extraExpense}
                                onChange={e => setMonthAdjustments({ ...monthAdjustments, extraExpense: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Vacations */}
                    <div style={{ marginTop: '1rem' }}>
                        <h4>🏖️ Hoca Tatil / İzin Durumu (1 Hafta)</h4>
                        <div className="grid-3">
                            {trainers.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => toggleVacation(t.id)}
                                    style={{
                                        padding: '0.5rem',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '0.5rem',
                                        cursor: 'pointer',
                                        background: monthAdjustments.vacations.includes(t.id) ? 'rgba(239, 68, 68, 0.2)' : 'var(--card-bg)',
                                        borderColor: monthAdjustments.vacations.includes(t.id) ? 'var(--danger-color)' : 'var(--border-color)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}
                                >
                                    <span>{t.name}</span>
                                    {monthAdjustments.vacations.includes(t.id) && <span>🏖️ İzinli</span>}
                                </div>
                            ))}
                        </div>
                        <small className="text-secondary">Seçilen hocalar bu ay 1 hafta (%25) daha az ders verecek.</small>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button className="btn-primary" style={{ width: 'auto', padding: '0.75rem 2rem' }} onClick={runNextStep}>
                            {currentStep >= simulationMonths ? '✅ Simülasyonu Tamamla' : '➡️ Ayı Kapat ve İlerle'}
                        </button>
                    </div>
                </div>
            )}

            {/* Results */}
            {
                (results && simulationMode === 'instant' || simulationMode === 'interactive' && results) && (
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
                                                    {/* Show adjustmens icon if any */}
                                                    {d.adjustments && (d.adjustments.volumePercent !== 0 || d.adjustments.extraExpense !== 0 || d.adjustments.vacations.length > 0) && (
                                                        <div style={{ fontSize: '0.7em', color: 'var(--accent-color)' }}>⚠️ Müdaheleli</div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem', color: 'var(--success-color)' }}>{formatCurrency(d.revenue)}</td>
                                                <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{formatCurrency(d.vat)}</td>
                                                <td style={{ padding: '1rem', color: 'var(--danger-color)' }}>{formatCurrency(d.expenses)}</td>
                                                <td style={{ padding: '1rem', color: '#fbbf24', fontWeight: d.tax > 0 ? 'bold' : 'normal' }}>
                                                    {formatCurrency(d.tax)}
                                                    {d.taxDiscrepancy && d.taxDiscrepancy !== 0 && (
                                                        <div style={{ fontSize: '0.7em', color: d.taxDiscrepancy > 0 ? 'var(--danger-color)' : 'var(--success-color)', marginTop: '0.2rem' }}>
                                                            {d.taxDiscrepancy > 0 ? `+${formatCurrency(d.taxDiscrepancy)} Fark` : `${formatCurrency(d.taxDiscrepancy)} İade`}
                                                        </div>
                                                    )}
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
                )
            }
        </div >
    );
}

export default App;
