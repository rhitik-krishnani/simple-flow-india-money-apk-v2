
export type Language = 'en' | 'hi';

export interface Translation {
    // Nav & Common
    dashboard: string;
    portfolio: string;
    budget: string;
    goals: string;
    loans: string;
    insurance: string;
    calculators: string;
    add: string;
    save: string;
    cancel: string;
    edit: string;
    delete: string;
    loading: string;
    back: string;
    next: string;
    
    // Dashboard & Metrics
    netWorth: string;
    safetyNet: string;
    marketPulse: string;
    consolidatedBalance: string;
    survivalRunway: string;
    recentTransactions: string;
    priorityActions: string;
    financialHealthHub: string;
    financialPowerTools: string;
    aiDrivenWealthEngine: string;
    primaryTagline: string;
    secondaryTagline: string;
    
    // Portfolio
    consolidatedValue: string;
    absoluteReturn: string;
    totalPL: string;
    investedAmount: string;
    currentVal: string;
    units: string;
    assetAllocation: string;
    addInvestment: string;
    investmentName: string;
    assetType: string;
    sipAmount: string;
    allHoldings: string;
    smartSync: string;
    deepAnalysis: string;
    benchmarkAnalytics: string;
    aiStatementParser: string;
    
    // Budget
    income: string;
    expenses: string;
    subscriptions: string;
    smartImport: string;
    moneyFlow: string;
    availableToInvest: string;
    monthlyBudget: string;
    addTransaction: string;
    category: string;
    amount: string;
    date: string;
    analyze: string;
    addTxn: string;
    
    // Goals
    myGoals: string;
    addGoal: string;
    activeGoals: string;
    fireSimulator: string;
    defineNewGoal: string;
    targetAmount: string;
    targetDate: string;
    progress: string;
    remaining: string;

    // Asset Forge
    assetForge: string;
    healthScore: string;
    optimallyDiversified: string;
    moderateConcentration: string;
    highlyConcentrated: string;
    realTimeVault: string;
    marketSync: string;
    aiAudit: string;
    bulkImport: string;
    mfImport: string;
    syncPrices: string;
    addAsset: string;

    // Layout Groups
    command: string;
    intelligence: string;
    strategies: string;
    more: string;
    // SMS Tracking
    smsDetected: string;
    reviewTransaction: string;
    approveAndAdd: string;
    ignoreSms: string;
    smsTrackingEnabled: string;
    // Analytics
    totalUsers: string;
    activeUsers: string;
    totalHits: string;
    reports: string;
    financialReports: string;
    spendingByType: string;
    incomeVsExpense: string;
    netWorthTrend: string;
    customRange: string;
    generateReport: string;
    yearlySummary: string;
    monthlyBreakdown: string;
}

export const translations: Record<Language, Translation> = {
    en: {
        dashboard: "Home",
        portfolio: "My Investments",
        budget: "Spend & Save",
        goals: "Goals",
        loans: "Loans & EMIs",
        insurance: "Insurance",
        calculators: "Calculators",
        add: "Add",
        save: "Save",
        cancel: "Cancel",
        edit: "Edit",
        delete: "Delete",
        loading: "Hang tight…",
        back: "Back",
        next: "Next",
        
        netWorth: "Net Worth",
        safetyNet: "Rainy-Day Fund",
        marketPulse: "Market Pulse",
        consolidatedBalance: "Everything you own, minus what you owe",
        survivalRunway: "Months you're covered",
        recentTransactions: "Recent Spends",
        priorityActions: "Your next move",
        financialHealthHub: "Money Health",
        financialPowerTools: "Power Tools",
        aiDrivenWealthEngine: "Smart Insights",
        primaryTagline: "Your money, finally making sense.",
        secondaryTagline: "Level up your finances",
        
        consolidatedValue: "Total Portfolio Value",
        absoluteReturn: "Absolute Return",
        totalPL: "Total P&L",
        investedAmount: "Invested",
        currentVal: "Market Value",
        units: "Units",
        assetAllocation: "Allocation",
        addInvestment: "Add Asset",
        investmentName: "Asset Name",
        assetType: "Asset Type",
        sipAmount: "Monthly SIP",
        allHoldings: "All Assets",
        smartSync: "Smart Sync",
        deepAnalysis: "Check my portfolio",
        benchmarkAnalytics: "Benchmark",
        aiStatementParser: "Statement Import",
        
        income: "Money In",
        expenses: "Spends",
        subscriptions: "Bills & Subs",
        smartImport: "Import",
        moneyFlow: "Spend & Save",
        availableToInvest: "Available",
        monthlyBudget: "Budget",
        addTransaction: "Add Transaction",
        category: "Category",
        amount: "Amount",
        date: "Date",
        analyze: "Check my spending ✨",
        addTxn: "Log it",
        
        myGoals: "Financial Goals",
        addGoal: "Add Goal",
        activeGoals: "Active Goals",
        fireSimulator: "FIRE Sim",
        defineNewGoal: "Set New Goal",
        targetAmount: "Target",
        targetDate: "Target Date",
        progress: "Progress",
        remaining: "Remaining",

        assetForge: "Indian Money Code",
        healthScore: "Health Score",
        optimallyDiversified: "Highly Diversified",
        moderateConcentration: "Moderate Risk",
        highlyConcentrated: "High Concentration Risk",
        realTimeVault: "Real-Time Asset Vault",
        marketSync: "Market Sync",
        aiAudit: "AI Audit",
        bulkImport: "Bulk Import",
        mfImport: "MF Import",
        syncPrices: "Sync",
        addAsset: "Add Asset",

        command: "Command",
        intelligence: "Intelligence",
        strategies: "Strategies",
        more: "More",
        smsDetected: "Transaction Detected",
        reviewTransaction: "Review SMS Transaction",
        approveAndAdd: "Approve & Add",
        ignoreSms: "Ignore",
        smsTrackingEnabled: "SMS Tracking is Active",
        totalUsers: "Total Registered Users",
        activeUsers: "Unique Active Users",
        totalHits: "Total Interactions",
        reports: "Wealth Reports",
        financialReports: "Financial Intelligence Reports",
        spendingByType: "Spending by Category",
        incomeVsExpense: "Income vs Expense",
        netWorthTrend: "Net Worth Evolution",
        customRange: "Custom Range",
        generateReport: "Sync Report",
        yearlySummary: "Yearly Intelligence",
        monthlyBreakdown: "Monthly Breakdown"
    },
    hi: {
        dashboard: "डैशबोर्ड",
        portfolio: "कुल निवेश",
        budget: "बजट और फ्लो",
        goals: "वित्तीय लक्ष्य",
        loans: "ऋण और ईएमआई",
        insurance: "बीमा हब",
        calculators: "कैलकुलेटर",
        add: "जोड़ें",
        save: "सहेजें",
        cancel: "रद्द करें",
        edit: "बदलें",
        delete: "हटाएं",
        loading: "लोड हो रहा है...",
        back: "पीछे",
        next: "आगे",
        
        netWorth: "कुल संपत्ति",
        safetyNet: "सुरक्षा कवच",
        marketPulse: "बाज़ार की नब्ज",
        consolidatedBalance: "कुल शेष राशि",
        survivalRunway: "बचाव अवधि",
        recentTransactions: "हाल के लेनदेन",
        priorityActions: "महत्वपूर्ण कार्य",
        financialHealthHub: "वित्तीय स्वास्थ्य",
        financialPowerTools: "वित्तीय टूल्स",
        aiDrivenWealthEngine: "AI वेल्थ इंजन",
        primaryTagline: "हर भारतीय के लिए धन का डिकोडिंग",
        secondaryTagline: "वित्तीय स्वतंत्रता के लिए आपका ब्लूप्रिंट",
        
        consolidatedValue: "कुल पोर्टफोलियो मूल्य",
        absoluteReturn: "कुल रिटर्न",
        totalPL: "कुल लाभ/हानि",
        investedAmount: "निवेश राशि",
        currentVal: "बाज़ार मूल्य",
        units: "यूनिट्स",
        assetAllocation: "संपत्ति आवंटन",
        addInvestment: "निवेश जोड़ें",
        investmentName: "निवेश का नाम",
        assetType: "संपत्ति का प्रकार",
        sipAmount: "SIP राशि",
        allHoldings: "सभी होल्डिंग्स",
        smartSync: "स्मार्ट सिंक",
        deepAnalysis: "AI विश्लेषण",
        benchmarkAnalytics: "बेंचमार्क",
        aiStatementParser: "AI स्टेटमेंट पार्सर",
        
        income: "आय",
        expenses: "खर्च",
        subscriptions: "बिल",
        smartImport: "AI इम्पोर्ट",
        moneyFlow: "पैसे का बहाव",
        availableToInvest: "निवेश उपलब्ध",
        monthlyBudget: "बजट",
        addTransaction: "लेनदेन जोड़ें",
        category: "श्रेणी",
        amount: "राशि",
        date: "तारीख",
        analyze: "विश्लेषण",
        addTxn: "लेनदेन जोड़ें",
        
        myGoals: "वित्तीय लक्ष्य",
        addGoal: "लक्षय जोड़ें",
        activeGoals: "सक्रिय लक्ष्य",
        fireSimulator: "FIRE सिम्युलेटर",
        defineNewGoal: "नया लक्ष्य निर्धारित करें",
        targetAmount: "लक्ष्य",
        targetDate: "लक्ष्य तिथि",
        progress: "प्रगति",
        remaining: "शेष राशि",

        assetForge: "इंडियन मनी कोड",
        healthScore: "हेल्थ स्कोर",
        optimallyDiversified: "बेहतर विविधता",
        moderateConcentration: "मध्यम जोखिम",
        highlyConcentrated: "उच्च जोखिम",
        realTimeVault: "रियल-टाइम एसेट वॉल्ट",
        marketSync: "मार्केट सिंक",
        aiAudit: "AI ऑडिट",
        bulkImport: "बल्क इम्पोर्ट",
        mfImport: "MF इम्पोर्ट",
        syncPrices: "सिंक",
        addAsset: "निवेश जोड़ें",

        command: "कमांड",
        intelligence: "इंटेलिजेंस",
        strategies: "रणनीति",
        more: "अधिक",
        smsDetected: "लेनदेन का पता चला",
        reviewTransaction: "SMS लेनदेन की समीक्षा करें",
        approveAndAdd: "स्वीकार करें और जोड़ें",
        ignoreSms: "अनदेखा करें",
        smsTrackingEnabled: "SMS ट्रैकिंग सक्रिय है",
        totalUsers: "कुल पंजीकृत उपयोगकर्ता",
        activeUsers: "सक्रिय उपयोगकर्ता",
        totalHits: "कुल इंटरैक्शन",
        reports: "वेल्थ रिपोर्ट्स",
        financialReports: "वित्तीय इंटेलिजेंस रिपोर्ट्स",
        spendingByType: "श्रेणी के अनुसार खर्च",
        incomeVsExpense: "आय बनाम खर्च",
        netWorthTrend: "कुल संपत्ति का विकास",
        customRange: "कस्टम रेंज",
        generateReport: "रिपोर्ट सिंक करें",
        yearlySummary: "वार्षिक इंटेलिजेंस",
        monthlyBreakdown: "मासिक विश्लेषण"
    }
};
