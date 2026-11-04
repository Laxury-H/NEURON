"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  pureBw: boolean;
  setPureBw: (pureBw: boolean) => void;
  togglePureBw: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [pureBw, setPureBwState] = useState<boolean>(false);

  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem("neuron_theme") as Theme | null;
    if (savedTheme === "dark" || savedTheme === "light") {
      setThemeState(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setThemeState(initial);
      document.documentElement.classList.toggle("dark", initial === "dark");
    }

    // Pure 1-bit B&W initialization
    const savedPureBw = localStorage.getItem("neuron_pure_bw");
    const isPure = savedPureBw === "true";
    setPureBwState(isPure);
    document.documentElement.classList.toggle("pure-bw", isPure);
    document.documentElement.setAttribute("data-pure-bw", isPure ? "true" : "false");
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("neuron_theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const setPureBw = (newPureBw: boolean) => {
    setPureBwState(newPureBw);
    localStorage.setItem("neuron_pure_bw", String(newPureBw));
    document.documentElement.classList.toggle("pure-bw", newPureBw);
    document.documentElement.setAttribute("data-pure-bw", newPureBw ? "true" : "false");
  };

  const togglePureBw = () => {
    setPureBw(!pureBw);
  };

  // Avoid flash
  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        pureBw,
        setPureBw,
        togglePureBw,
      }}
    >
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
