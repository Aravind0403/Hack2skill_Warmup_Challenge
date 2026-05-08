import React, { useEffect } from 'react';
import { useTrip, Vibe } from '../context/TripContext';

const themeMap: Record<Vibe, string> = {
    spiritual: 'theme-spiritual',
    adventure: 'theme-adventure',
    beach: 'theme-beach',
    culture: 'theme-culture',
    luxury: 'theme-luxury'
};

export const ThemeSwitcher = ({ children }: { children: React.ReactNode }) => {
    const { state } = useTrip();

    useEffect(() => {
        // Remove all theme classes
        Object.values(themeMap).forEach(themeClass => {
            document.documentElement.classList.remove(themeClass);
        });
        
        // Add current theme class
        const currentTheme = themeMap[state.vibe] || themeMap.adventure;
        document.documentElement.classList.add(currentTheme);
    }, [state.vibe]);

    return (
        <div className="min-h-screen transition-colors duration-1000 ease-in-out bg-theme-bg">
            <div className="fixed inset-0 pointer-events-none bg-gradient-radial from-theme-accent/20 to-transparent opacity-50"></div>
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};
