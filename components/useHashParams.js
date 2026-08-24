"use client";

import { useEffect, useState } from "react";

function readHashParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.hash.slice(1));
}

export function useHashParams() {
  const [hashParams, setHashParams] = useState(() => new URLSearchParams());

  useEffect(() => {
    const updateHashParams = () => setHashParams(readHashParams());

    updateHashParams();
    window.addEventListener("hashchange", updateHashParams);
    return () => window.removeEventListener("hashchange", updateHashParams);
  }, []);

  return hashParams;
}
