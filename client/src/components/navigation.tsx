import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Edit, Library, Sparkles } from "lucide-react";

export function Navigation() {
  const [location] = useLocation();

  return (
    <nav className="border-b border-border bg-background px-6 py-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">AI Image Editor</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button 
              variant={location === "/" ? "default" : "ghost"}
              size="sm"
              data-testid="nav-editor"
            >
              <Edit className="w-4 h-4 mr-2" />
              Editor
            </Button>
          </Link>
          
          <Link href="/library">
            <Button 
              variant={location === "/library" ? "default" : "ghost"}
              size="sm"
              data-testid="nav-library"
            >
              <Library className="w-4 h-4 mr-2" />
              Library
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}