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
} from "lucide-react";

export function Landing() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Sparkles,
      title: "AI Image Generator",
      description: "Transform text into stunning visuals with advanced AI models",
      gradient: "from-blue-500 to-purple-600",
    },
    {
      icon: Wand2,
      title: "AI Enhancement",
      description: "Enhance image quality, resolution, and details automatically",
      gradient: "from-purple-500 to-pink-600",
    },
    {
      icon: Palette,
      title: "Style Transfer",
      description: "Apply artistic styles and creative effects to your images",
      gradient: "from-green-500 to-blue-600",
    },
    {
      icon: Zap,
      title: "Super Resolution",
      description: "Upscale images while preserving clarity and sharpness",
      gradient: "from-orange-500 to-red-600",
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
            <h1 className="text-lg font-semibold">AI Image Generator</h1>
          </div>
          <Button
            onClick={() => setLocation("/editor")}
            variant="ghost"
            className="text-[#e0e0e0] hover:bg-[#2a2a2a] hover:text-white"
            data-testid="header-editor-link"
          >
            Open Editor
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
            AI Image Generator
            <br />
            <span className="text-[#ffd700]">Magic</span> in Your Browser
          </h1>
          
          <p className="text-xl text-[#e0e0e0] mb-12 max-w-3xl mx-auto leading-relaxed">
            Generate stunning images from text, enhance photo quality, and transform your creative vision 
            into reality with our powerful AI tools. Free to try, professional results.
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
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Powerful AI Tools
            </h2>
            <p className="text-xl text-[#e0e0e0] max-w-2xl mx-auto">
              Everything you need to create, enhance, and transform images with cutting-edge AI technology
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

      {/* CTA Section */}
      <section className="px-6 py-20 bg-[#1a1a1a]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Create Something Amazing?
          </h2>
          <p className="text-xl text-[#e0e0e0] mb-8 max-w-2xl mx-auto">
            Join thousands of creators using AI to bring their vision to life. 
            Start generating incredible images in seconds.
          </p>
          <Button
            onClick={() => setLocation("/editor")}
            size="lg"
            className="bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-semibold px-12 py-4 text-lg"
            data-testid="button-get-started"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Get Started Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2a2a2a] px-6 py-8 bg-[#0f0f0f]">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-6 h-6 bg-[#ffd700] rounded-lg flex items-center justify-center">
              <ImageIcon className="w-3 h-3 text-black" />
            </div>
            <span className="font-semibold">AI Image Generator</span>
          </div>
          <p className="text-sm text-[#888888]">
            Powered by advanced AI models for professional image generation and editing
          </p>
        </div>
      </footer>
    </div>
  );
}