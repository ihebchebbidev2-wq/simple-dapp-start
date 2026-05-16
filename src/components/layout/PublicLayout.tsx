import React from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import AnalyticsPageTracker from "@/components/AnalyticsPageTracker";
import SEOHead from "@/components/SEOHead";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <AnalyticsPageTracker />
      <SEOHead />
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
