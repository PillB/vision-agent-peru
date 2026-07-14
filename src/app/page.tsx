'use client'

import { useState } from 'react'
import { Camera, FileText, Activity, Presentation } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Tab1Overview } from '@/components/tab1-overview'
import { Tab2Prototype } from '@/components/tab2-prototype'
import { Tab3StrategicBrief } from '@/components/tab3-strategic-brief'

type TabId = 'overview' | 'prototype' | 'brief'

export default function Home() {
  const [tab, setTab] = useState<TabId>('overview')

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Top App Bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-emerald-600 text-white flex items-center justify-center">
              <Camera className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-lg text-zinc-950">Cusco Vision Agent</span>
              <span className="hidden sm:inline text-xs text-zinc-500 font-mono">v1.0 · Peru</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono">System ready</span>
            </div>
            <a
              href="https://www.skylinewebcams.com/en/webcam/peru/cusco/cusco/plaza-mayor.html"
              target="_blank"
              rel="noreferrer noopener"
              className="hidden md:inline-flex text-xs text-zinc-500 hover:text-emerald-700 transition"
            >
              Reference: SkylineWebcams Peru ↗
            </a>
          </div>
        </div>
      </header>

      {/* Tab Nav */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 md:px-8">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabsList className="bg-transparent h-12 p-0 gap-6">
              <TabsTrigger
                value="overview"
                className="bg-transparent px-0 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-zinc-950 text-zinc-500 hover:text-zinc-900 transition"
              >
                <FileText className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Solution Overview</span>
              </TabsTrigger>
              <TabsTrigger
                value="brief"
                className="bg-transparent px-0 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-zinc-950 text-zinc-500 hover:text-zinc-900 transition"
              >
                <Presentation className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Strategic Brief</span>
              </TabsTrigger>
              <TabsTrigger
                value="prototype"
                className="bg-transparent px-0 py-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-zinc-950 text-zinc-500 hover:text-zinc-900 transition"
              >
                <Activity className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Live Prototype</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
              <Tab1Overview
                onTryPrototype={() => setTab('prototype')}
              />
            </TabsContent>
            <TabsContent value="brief" className="mt-0 focus-visible:outline-none">
              <Tab3StrategicBrief
                onTryPrototype={() => setTab('prototype')}
                onSeeOverview={() => setTab('overview')}
              />
            </TabsContent>
            <TabsContent value="prototype" className="mt-0 focus-visible:outline-none">
              <Tab2Prototype />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-mono">Source:</span>
            <span>TF.js COCO-SSD (Google); Z-AI Web Dev SDK; internal simulation on Pexels/Pixabay stock footage of Peru plaza scenes.</span>
          </div>
          <div className="font-mono">2026-07-14 · Cusco, Peru</div>
        </div>
      </footer>
    </div>
  )
}
