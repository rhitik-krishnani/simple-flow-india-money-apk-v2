
export interface MFScheme {
    schemeCode: number;
    schemeName: string;
}

export interface MFDataPoint {
    date: string;
    nav: string;
}

export interface MFSchemeDetails {
    meta: {
        fund_house: string;
        scheme_type: string;
        scheme_category: string;
        scheme_code: number;
        scheme_name: string;
    };
    data: MFDataPoint[];
    status: string;
}

const BASE_URL = 'https://api.mfapi.in';

export const searchMFSchemes = async (query: string): Promise<MFScheme[]> => {
    try {
        const response = await fetch(`${BASE_URL}/mf/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) throw new Error('Failed to fetch MF schemes');
        return await response.json();
    } catch (error) {
        console.error('Error searching MF schemes:', error);
        return [];
    }
};

export const getMFSchemeDetails = async (schemeCode: string | number): Promise<MFSchemeDetails | null> => {
    try {
        const response = await fetch(`${BASE_URL}/mf/${schemeCode}`);
        if (!response.ok) throw new Error('Failed to fetch MF details');
        return await response.json();
    } catch (error) {
        console.error('Error fetching MF details:', error);
        return null;
    }
};

/**
 * Calculates CAGR (Annualized Return)
 * Formula: ((Current Value / Initial Value) ^ (1 / Number of Years)) - 1
 */
export const calculateCAGR = (currentNav: number, purchaseNav: number, purchaseDate: Date): number => {
    const today = new Date();
    const years = (today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years <= 0) return 0;
    
    const cagr = Math.pow(currentNav / purchaseNav, 1 / years) - 1;
    return parseFloat((cagr * 100).toFixed(2));
};

export const findNavOnDate = (data: MFDataPoint[], targetDate: Date): number | null => {
    // Reverse data (usually comes newest to oldest, but let's be sure)
    // Actually MFAPI data is newest to oldest usually.
    
    const targetTime = targetDate.getTime();
    
    // Simple closest date search
    let closestNav = null;
    let minDiff = Infinity;
    
    for (const point of data) {
        // Date format in MFAPI is DD-MM-YYYY
        const [d, m, y] = point.date.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const diff = Math.abs(date.getTime() - targetTime);
        
        if (diff < minDiff) {
            minDiff = diff;
            closestNav = parseFloat(point.nav);
        }
        
        // If we found the exact date or passed it (since it's sorted)
        if (diff === 0) break;
    }
    
    return closestNav;
};
