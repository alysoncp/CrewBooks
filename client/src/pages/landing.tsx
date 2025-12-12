import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, FileText, Calculator, TrendingUp, Shield, Camera } from "lucide-react";

export default function Landing() {
  const features = [
    {
      icon: DollarSign,
      title: "Income Tracking",
      description: "Track wages, residuals, per diem, and all film/TV industry income types",
    },
    {
      icon: FileText,
      title: "Expense Management",
      description: "Categorize equipment, union dues, travel, and other deductible expenses",
    },
    {
      icon: Camera,
      title: "Receipt Upload",
      description: "Snap photos of receipts and store them securely for tax time",
    },
    {
      icon: Calculator,
      title: "Tax Calculations",
      description: "Canadian federal and provincial tax estimates updated in real-time",
    },
    {
      icon: TrendingUp,
      title: "Optimization Tools",
      description: "Dividend vs. salary optimizer for incorporated professionals",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your financial data is encrypted and protected",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-4 md:text-5xl">
            Financial Management for
            <span className="block text-primary">Film & TV Professionals</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            CrewBooks helps self-employed performers and crew track income, expenses, 
            and calculate Canadian taxes throughout the year.
          </p>
          <a href="/api/login">
            <Button size="lg" className="text-lg px-8" data-testid="button-login">
              Sign In to Get Started
            </Button>
          </a>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-16">
          {features.map((feature) => (
            <Card key={feature.title} className="hover-elevate">
              <CardHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Built for the Canadian Film & TV Industry</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Whether you're a grip, actor, camera operator, or any other crew member, 
            CrewBooks understands your unique financial needs and helps you stay 
            organized for tax season.
          </p>
        </div>
      </div>
    </div>
  );
}
