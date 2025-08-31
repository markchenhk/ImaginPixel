import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Wand2, ImageIcon, Eye, EyeOff } from "lucide-react";

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  email?: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export function AuthPage() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  // Form states
  const [loginForm, setLoginForm] = useState<LoginData>({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState<RegisterData>({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Welcome back!",
        description: `Successfully logged in as ${user.username}`,
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Account created!",
        description: `Welcome to AI Image Editor, ${user.username}!`,
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      toast({
        title: "Missing fields",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }
    loginMutation.mutate(loginForm);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.username || !registerForm.password) {
      toast({
        title: "Missing fields",
        description: "Username and password are required",
        variant: "destructive",
      });
      return;
    }
    registerMutation.mutate(registerForm);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ffd700] mx-auto"></div>
          <p className="mt-4 text-[#e0e0e0]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0f0f0f]">
      {/* Left Side - Hero/Info */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-[#1a1a1a] to-[#0f0f0f]">
        <div className="max-w-md text-center text-white">
          <div className="w-16 h-16 bg-[#ffd700] rounded-2xl flex items-center justify-center mx-auto mb-8">
            <ImageIcon className="w-8 h-8 text-black" />
          </div>
          
          <h1 className="text-4xl font-bold mb-4">
            AI Product Studio
          </h1>
          
          <p className="text-xl text-[#e0e0e0] mb-8">
            Transform ordinary product photos into professional e-commerce images. 
            Perfect for online marketplaces and driving sales.
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-[#2a2a2a] p-4 rounded-lg">
              <Wand2 className="w-6 h-6 text-[#ffd700] mx-auto mb-2" />
              <p className="text-[#e0e0e0]">Product Enhancement</p>
            </div>
            <div className="bg-[#2a2a2a] p-4 rounded-lg">
              <ImageIcon className="w-6 h-6 text-[#ffd700] mx-auto mb-2" />
              <p className="text-[#e0e0e0]">Marketplace Ready</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#0f0f0f]">
        <div className="w-full max-w-md">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#2a2a2a] border-[#3a3a3a]">
              <TabsTrigger 
                value="login" 
                className="text-[#e0e0e0] data-[state=active]:bg-[#ffd700] data-[state=active]:text-black"
                data-testid="tab-login"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="register" 
                className="text-[#e0e0e0] data-[state=active]:bg-[#ffd700] data-[state=active]:text-black"
                data-testid="tab-register"
              >
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white text-center">Welcome back</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username" className="text-[#e0e0e0]">
                        Username
                      </Label>
                      <Input
                        id="login-username"
                        type="text"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                        className="bg-[#2a2a2a] border-[#3a3a3a] text-white"
                        placeholder="Enter your username"
                        disabled={loginMutation.isPending}
                        data-testid="input-login-username"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-[#e0e0e0]">
                        Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          value={loginForm.password}
                          onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                          className="bg-[#2a2a2a] border-[#3a3a3a] text-white pr-10"
                          placeholder="Enter your password"
                          disabled={loginMutation.isPending}
                          data-testid="input-login-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-[#888]" />
                          ) : (
                            <Eye className="h-4 w-4 text-[#888]" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-semibold"
                      disabled={loginMutation.isPending}
                      data-testid="button-login-submit"
                    >
                      {loginMutation.isPending ? "Logging in..." : "Login"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardHeader>
                  <CardTitle className="text-white text-center">Create your account</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="register-firstname" className="text-[#e0e0e0]">
                          First Name
                        </Label>
                        <Input
                          id="register-firstname"
                          type="text"
                          value={registerForm.firstName}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, firstName: e.target.value }))}
                          className="bg-[#2a2a2a] border-[#3a3a3a] text-white"
                          placeholder="First name"
                          disabled={registerMutation.isPending}
                          data-testid="input-register-firstname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-lastname" className="text-[#e0e0e0]">
                          Last Name
                        </Label>
                        <Input
                          id="register-lastname"
                          type="text"
                          value={registerForm.lastName}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, lastName: e.target.value }))}
                          className="bg-[#2a2a2a] border-[#3a3a3a] text-white"
                          placeholder="Last name"
                          disabled={registerMutation.isPending}
                          data-testid="input-register-lastname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-username" className="text-[#e0e0e0]">
                        Username *
                      </Label>
                      <Input
                        id="register-username"
                        type="text"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, username: e.target.value }))}
                        className="bg-[#2a2a2a] border-[#3a3a3a] text-white"
                        placeholder="Choose a username"
                        disabled={registerMutation.isPending}
                        data-testid="input-register-username"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email" className="text-[#e0e0e0]">
                        Email
                      </Label>
                      <Input
                        id="register-email"
                        type="email"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                        className="bg-[#2a2a2a] border-[#3a3a3a] text-white"
                        placeholder="your.email@example.com"
                        disabled={registerMutation.isPending}
                        data-testid="input-register-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password" className="text-[#e0e0e0]">
                        Password *
                      </Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                          className="bg-[#2a2a2a] border-[#3a3a3a] text-white pr-10"
                          placeholder="Create a password"
                          disabled={registerMutation.isPending}
                          data-testid="input-register-password"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-[#888]" />
                          ) : (
                            <Eye className="h-4 w-4 text-[#888]" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-[#ffd700] hover:bg-[#ffd700]/90 text-black font-semibold"
                      disabled={registerMutation.isPending}
                      data-testid="button-register-submit"
                    >
                      {registerMutation.isPending ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}