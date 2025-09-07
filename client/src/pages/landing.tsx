import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import {
  Wand2,
  Sparkles,
  Palette,
  Zap,
  ImageIcon,
  Download,
  ArrowRight,
  Stars,
  Building2,
  GraduationCap,
  ShoppingBag,
  Briefcase,
  Camera,
  Presentation,
  Users,
  Target,
} from "lucide-react";

export function Landing() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Sparkles,
      title: "Smart Content Creation",
      description: "Generate professional visuals for marketing, presentations, and brand materials",
      gradient: "from-blue-500 to-purple-600",
    },
    {
      icon: Wand2,
      title: "Background & Style Transfer",
      description: "Replace backgrounds and transform image styles for any business context",
      gradient: "from-purple-500 to-pink-600",
    },
    {
      icon: Palette,
      title: "Professional Enhancement",
      description: "Perfect lighting, colors, and quality for business-grade visual content",
      gradient: "from-green-500 to-blue-600",
    },
    {
      icon: Zap,
      title: "Multi-Platform Ready",
      description: "Create optimized visuals for websites, social media, presentations, and print",
      gradient: "from-orange-500 to-red-600",
    },
  ];

  const industries = [
    {
      icon: ShoppingBag,
      title: "E-commerce & Retail",
      description: "Product catalogs, marketplace listings, promotional materials",
      applications: ["Product photos", "Banner ads", "Social media content"],
    },
    {
      icon: Building2,
      title: "Corporate & Office",
      description: "Professional presentations, reports, internal communications",
      applications: ["Company reports", "Presentation slides", "Team photos"],
    },
    {
      icon: GraduationCap,
      title: "Education & Training",
      description: "Course materials, educational content, student presentations",
      applications: ["Learning materials", "Course thumbnails", "Academic presentations"],
    },
    {
      icon: Briefcase,
      title: "Professional Services",
      description: "Client proposals, marketing materials, portfolio showcases",
      applications: ["Service portfolios", "Client presentations", "Marketing collateral"],
    },
    {
      icon: Camera,
      title: "Creative & Media",
      description: "Content creation, social media, digital marketing campaigns",
      applications: ["Social content", "Ad creatives", "Brand materials"],
    },
    {
      icon: Users,
      title: "Marketing Agencies",
      description: "Client campaigns, brand assets, multi-channel content creation",
      applications: ["Campaign assets", "Brand guidelines", "Client deliverables"],
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-4 bg-[#1a1a1a]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#ffd700] rounded-lg flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-black" />
            </div>
            <h1 className="text-lg font-semibold">AI Visual Studio</h1>
          </div>
          <Button
            onClick={() => setLocation("/editor")}
            className="bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-semibold"
            data-testid="header-login-button"
          >
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-20 bg-gradient-to-b from-[#1a1a1a] to-[#0f0f0f]">
        <div className="max-w-6xl mx-auto text-center">
          <div className="w-16 h-16 bg-[#ffd700] rounded-2xl flex items-center justify-center mx-auto mb-8">
            <Stars className="w-8 h-8 text-black" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            AI-Powered Visual Content
            <br />
            for <span className="text-[#ffd700]">Every Business</span> Need
          </h1>
          
          <p className="text-xl text-[#e0e0e0] mb-12 max-w-3xl mx-auto leading-relaxed">
            Transform any image into professional-grade visual content for your business. 
            From e-commerce to education, corporate to creative - enhance, edit, and optimize visuals powered by advanced AI technology.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              onClick={() => setLocation("/editor")}
              size="lg"
              className="bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-semibold px-8 py-4 text-lg"
              data-testid="button-start-creating"
            >
              <Wand2 className="w-5 h-5 mr-2" />
              Start Creating
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[#2a2a2a] text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white px-8 py-4 text-lg"
              data-testid="button-learn-more"
            >
              Explore Features
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              AI-Powered Visual Solutions
            </h2>
            <p className="text-xl text-[#e0e0e0] max-w-2xl mx-auto">
              Professional-grade tools designed for businesses across every industry and use case
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <Card
                  key={index}
                  className="bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-300 group cursor-pointer"
                  onClick={() => setLocation("/editor")}
                  data-testid={`feature-card-${index}`}
                >
                  <CardContent className="p-6 text-center">
                    <div className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-white">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-[#888888] leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="px-6 py-20 bg-[#1a1a1a]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for Every Industry
            </h2>
            <p className="text-xl text-[#e0e0e0] max-w-3xl mx-auto">
              From small businesses to large enterprises, our AI visual platform adapts to your specific industry needs and workflows
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {industries.map((industry, index) => {
              const IconComponent = industry.icon;
              return (
                <Card
                  key={index}
                  className="bg-[#0f0f0f] border-[#2a2a2a] hover:border-[#3a3a3a] transition-all duration-300 group cursor-pointer"
                  onClick={() => setLocation("/editor")}
                  data-testid={`industry-card-${index}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-white mb-1">
                          {industry.title}
                        </h3>
                        <p className="text-sm text-[#888888]">
                          {industry.description}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {industry.applications.map((app, appIndex) => (
                        <div key={appIndex} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-[#ffd700] rounded-full flex-shrink-0" />
                          <span className="text-sm text-[#e0e0e0]">{app}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-[#0f0f0f]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Transform Your Business Visuals?
          </h2>
          <p className="text-xl text-[#e0e0e0] mb-8 max-w-2xl mx-auto">
            Join thousands of businesses across industries using AI to create professional visual content that drives results. 
            Start enhancing your images and content in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => setLocation("/editor")}
              size="lg"
              className="border border-[#ffd700] bg-[#ffd700]/10 hover:bg-[#ffd700]/20 text-[#ffd700] font-semibold px-12 py-4 text-lg"
              data-testid="button-get-started"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Creating Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[#2a2a2a] text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white px-8 py-4 text-lg"
              data-testid="button-view-demo"
            >
              <Target className="w-5 h-5 mr-2" />
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2a2a2a] px-6 py-8 bg-[#0f0f0f]">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-6 h-6 bg-[#ffd700] rounded-lg flex items-center justify-center">
              <ImageIcon className="w-3 h-3 text-black" />
            </div>
            <span className="font-semibold">AI Visual Studio</span>
          </div>
          <p className="text-sm text-[#888888]">
            Powered by advanced AI technology for professional visual content creation across all industries
          </p>
        </div>
      </footer>
    </div>
  );
}