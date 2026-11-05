/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Home } from './pages/Home';
import { AllTools } from './pages/AllTools';
import { ImageToolsPage } from './pages/ImageToolsPage';
import { PdfToolsPage } from './pages/PdfToolsPage';
import { GuidesPage } from './pages/GuidesPage';
import { GuideDetailPage } from './pages/GuideDetailPage';
import { ToolPage } from './pages/ToolPage';
import { NotFound } from './pages/NotFound';
import { ToolItem, GuideItem } from './types';
import { getToolBySlug } from './data/tools';
import { getGuideBySlug } from './data/guides';

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  // Keep state synced with browser history
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTool = (tool: ToolItem) => {
    navigate(`/tool/${tool.slug}`);
  };

  const handleSelectGuide = (guide: GuideItem) => {
    navigate(`/guides/${guide.slug}`);
  };

  // Update document title dynamically
  useEffect(() => {
    if (currentPath === '/') {
      document.title = 'READYFILE — Every document. Ready to submit.';
    } else if (currentPath === '/tools') {
      document.title = 'All Document Tools (15) — READYFILE';
    } else if (currentPath === '/image-tools') {
      document.title = 'Image Preparation Tools — READYFILE';
    } else if (currentPath === '/pdf-tools') {
      document.title = 'PDF Document Tools — READYFILE';
    } else if (currentPath === '/guides') {
      document.title = 'Document Preparation Guides — READYFILE';
    } else if (currentPath.startsWith('/tool/')) {
      const slug = currentPath.replace('/tool/', '');
      const tool = getToolBySlug(slug);
      document.title = tool ? `${tool.name} — READYFILE` : 'Tool — READYFILE';
    } else if (currentPath.startsWith('/guides/')) {
      const slug = currentPath.replace('/guides/', '');
      const guide = getGuideBySlug(slug);
      document.title = guide ? `${guide.title} — READYFILE` : 'Guide — READYFILE';
    } else {
      document.title = 'READYFILE — Document Utility Platform';
    }
  }, [currentPath]);

  // Route resolver
  const renderContent = () => {
    if (currentPath === '/' || currentPath === '') {
      return <Home onNavigate={navigate} onSelectTool={handleSelectTool} />;
    }

    if (currentPath === '/tools') {
      return <AllTools onNavigate={navigate} onSelectTool={handleSelectTool} />;
    }

    if (currentPath === '/image-tools') {
      return <ImageToolsPage onNavigate={navigate} onSelectTool={handleSelectTool} />;
    }

    if (currentPath === '/pdf-tools') {
      return <PdfToolsPage onNavigate={navigate} onSelectTool={handleSelectTool} />;
    }

    if (currentPath === '/guides') {
      return <GuidesPage onNavigate={navigate} onSelectGuide={handleSelectGuide} />;
    }

    if (currentPath.startsWith('/guides/')) {
      const slug = currentPath.replace('/guides/', '');
      const guide = getGuideBySlug(slug);
      if (guide) {
        return (
          <GuideDetailPage
            guide={guide}
            onNavigate={navigate}
            onSelectTool={handleSelectTool}
          />
        );
      }
      return <NotFound onNavigate={navigate} />;
    }

    if (currentPath.startsWith('/tool/')) {
      const slug = currentPath.replace('/tool/', '');
      return (
        <ToolPage
          toolSlug={slug}
          onNavigate={navigate}
          onSelectTool={handleSelectTool}
        />
      );
    }

    return <NotFound onNavigate={navigate} />;
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col font-['Inter',sans-serif] text-[#182230]">
      {/* Main Header with navigation (desktop links visible, mobile hamburger removed) */}
      <Header currentPath={currentPath} onNavigate={navigate} />

      {/* Main Viewport Workspace with extra bottom clearance for mobile fixed bottom bar */}
      <main className="flex-1 pt-6 sm:pt-8 pb-28 md:pb-12">{renderContent()}</main>

      {/* Global Footer (pb-24 on mobile so footer text is never covered by the bottom bar) */}
      <div className="pb-20 md:pb-0">
        <Footer onNavigate={navigate} />
      </div>

      {/* Mobile Fixed Bottom Navigation (strictly hidden on desktop md:hidden) */}
      <MobileBottomNav currentPath={currentPath} onNavigate={navigate} />
    </div>
  );
}
