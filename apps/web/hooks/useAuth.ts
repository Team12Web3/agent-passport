"use client";

export function useAuth() {
  return {
    user: null,
    address: "0xA91E...2F4D",
    isLoggedIn: true,
    isLoading: false
  };
}
