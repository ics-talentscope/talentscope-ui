"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "misty-mountains" | "aqua" | "mustangs";

export const THEMES: Theme[] = ["misty-mountains", "aqua", "mustangs"];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  // Kept for backward compatibility if needed, but it might cycle through themes or just toggle light/dark
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("aqua");
  const [mounted, setMounted] = useState(false);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    root.classList.remove("dark", "blue", "purple", "emerald", "rose", "sunset", ...THEMES);
    root.classList.add(newTheme);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const selectedTheme: Theme = THEMES.includes(savedTheme as Theme) ? (savedTheme as Theme) : "aqua";
    setThemeState(selectedTheme);
    applyTheme(selectedTheme);
    localStorage.setItem("theme", selectedTheme);
    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => setTheme(theme === "aqua" ? "mustangs" : "aqua");

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
