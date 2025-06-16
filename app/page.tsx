import { Suspense } from 'react'
import { TrendingTokens } from '@/components/trending-tokens'
import { HeroSection } from '@/components/hero-section'
import { StatsSection } from '@/components/stats-section'
import { FeaturesSection } from '@/components/features-section'
import { RecentLaunches } from '@/components/recent-launches'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <main className="relative">
        <HeroSection />
        
        <div className="container mx-auto px-4 py-12 space-y-16">
          <Suspense fallback={<LoadingSpinner />}>
            <StatsSection />
          </Suspense>

          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Trending Tokens
              </h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                Discover the hottest meme tokens with the highest trading volume and community engagement
              </p>
            </div>
            <Suspense fallback={<LoadingSpinner />}>
              <TrendingTokens />
            </Suspense>
          </section>

          <section className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Recent Launches
              </h2>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                Fresh tokens just launched on the platform with fair distribution and community-driven growth
              </p>
            </div>
            <Suspense fallback={<LoadingSpinner />}>
              <RecentLaunches />
            </Suspense>
          </section>

          <FeaturesSection />
        </div>
      </main>
    </div>
  )
}