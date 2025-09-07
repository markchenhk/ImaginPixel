import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Mail, 
  Shield, 
  CreditCard, 
  BarChart3, 
  Calendar,
  Settings,
  Crown
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function Account() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Account Management</h1>

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-[#1a1a1a] border border-[#2a2a2a]">
            <TabsTrigger value="info" className="data-[state=active]:bg-[#ffd700] data-[state=active]:text-black">
              Account Info
            </TabsTrigger>
            <TabsTrigger value="usage" className="data-[state=active]:bg-[#ffd700] data-[state=active]:text-black">
              Usage
            </TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-[#ffd700] data-[state=active]:text-black">
              Security
            </TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-[#ffd700] data-[state=active]:text-black">
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Account Info Tab */}
          <TabsContent value="info" className="space-y-6">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={user?.firstName || ''}
                      className="bg-[#0f0f0f] border-[#2a2a2a] mt-2"
                      readOnly
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={user?.lastName || ''}
                      className="bg-[#0f0f0f] border-[#2a2a2a] mt-2"
                      readOnly
                    />
                  </div>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={user?.username || ''}
                      className="bg-[#0f0f0f] border-[#2a2a2a] mt-2"
                      readOnly
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      className="bg-[#0f0f0f] border-[#2a2a2a] mt-2"
                      readOnly
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="bg-[#ffd700] text-black">
                    <Crown className="w-3 h-3 mr-1" />
                    {user?.role === 'admin' ? 'Administrator' : 'User'}
                  </Badge>
                  <span className="text-sm text-[#888888]">
                    Member since {new Date(user?.createdAt || '').toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-8 h-8 text-[#ffd700] mx-auto mb-2" />
                  <div className="text-2xl font-bold">245</div>
                  <div className="text-sm text-[#888888]">Images Processed</div>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardContent className="p-4 text-center">
                  <Calendar className="w-8 h-8 text-[#ffd700] mx-auto mb-2" />
                  <div className="text-2xl font-bold">12</div>
                  <div className="text-sm text-[#888888]">Days Active</div>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardContent className="p-4 text-center">
                  <Settings className="w-8 h-8 text-[#ffd700] mx-auto mb-2" />
                  <div className="text-2xl font-bold">15.2GB</div>
                  <div className="text-sm text-[#888888]">Storage Used</div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle>Monthly Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-[#888888]">
                  Usage analytics and charts will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    className="bg-[#0f0f0f] border-[#2a2a2a] mt-2"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    className="bg-[#0f0f0f] border-[#2a2a2a] mt-2"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="bg-[#0f0f0f] border-[#2a2a2a] mt-2"
                    placeholder="Confirm new password"
                  />
                </div>
                <Button className="bg-[#ffd700] hover:bg-[#ffd700]/90 text-black">
                  Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Subscription & Billing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-[#0f0f0f] rounded-lg border border-[#2a2a2a]">
                  <div>
                    <div className="font-semibold">Free Plan</div>
                    <div className="text-sm text-[#888888]">100 image generations per month</div>
                  </div>
                  <Badge variant="outline" className="border-[#ffd700] text-[#ffd700]">
                    Current Plan
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="bg-[#0f0f0f] border-[#2a2a2a]">
                    <CardContent className="p-4">
                      <div className="text-lg font-semibold mb-2">Pro Plan</div>
                      <div className="text-2xl font-bold text-[#ffd700] mb-2">$19/month</div>
                      <ul className="text-sm text-[#888888] space-y-1">
                        <li>• Unlimited image generations</li>
                        <li>• Priority processing</li>
                        <li>• Advanced features</li>
                        <li>• Email support</li>
                      </ul>
                      <Button className="w-full mt-4 bg-[#ffd700] hover:bg-[#ffd700]/90 text-black">
                        Upgrade to Pro
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-[#0f0f0f] border-[#2a2a2a]">
                    <CardContent className="p-4">
                      <div className="text-lg font-semibold mb-2">Enterprise</div>
                      <div className="text-2xl font-bold text-[#ffd700] mb-2">Custom</div>
                      <ul className="text-sm text-[#888888] space-y-1">
                        <li>• Custom API access</li>
                        <li>• Dedicated support</li>
                        <li>• Custom integrations</li>
                        <li>• SLA guarantee</li>
                      </ul>
                      <Button variant="outline" className="w-full mt-4 border-[#ffd700] text-[#ffd700] hover:bg-[#ffd700] hover:text-black">
                        Contact Sales
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}