import { Film, DollarSign, Receipt, Calculator, TrendingUp, Shield, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function AboutPage() {
  const features = [
    {
      icon: DollarSign,
      title: "Income Tracking",
      description: "Track all your film and TV industry income including wages, residuals, per diem, buyouts, and royalties.",
    },
    {
      icon: Receipt,
      title: "Expense Management",
      description: "Categorize and track business expenses with industry-specific categories like equipment, union dues, agent fees, and wardrobe.",
    },
    {
      icon: Camera,
      title: "Receipt Storage",
      description: "Upload and store receipt photos securely for easy access during tax season.",
    },
    {
      icon: Calculator,
      title: "Tax Calculations",
      description: "Get real-time estimates of your Canadian federal and provincial tax obligations based on your income and expenses.",
    },
    {
      icon: TrendingUp,
      title: "Tax Optimization",
      description: "For incorporated professionals, compare dividend vs salary strategies to optimize your tax situation.",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your financial data is encrypted and stored securely. We take your privacy seriously.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Film className="h-6 w-6" />
          About CrewBooks
        </h1>
        <p className="text-muted-foreground mt-1">
          Financial management made simple for film and TV professionals.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What is CrewBooks?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed mb-4">
            CrewBooks is a comprehensive tax and financial management application designed specifically for 
            self-employed performers and crew members in the Canadian film and television industry. Whether 
            you're an actor, director, cinematographer, or any other industry professional, CrewBooks helps 
            you stay organized and prepared for tax season.
          </p>
          <p className="text-sm leading-relaxed">
            Our platform understands the unique financial needs of film and TV professionals, with features 
            tailored to industry-specific income types, expense categories, and tax considerations. From 
            tracking residuals and per diem to managing vehicle expenses and home office deductions, 
            CrewBooks has you covered.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Features</CardTitle>
          <CardDescription>Everything you need to manage your finances and taxes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {features.map((feature, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who is CrewBooks For?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed mb-4">
            CrewBooks is designed for anyone working in the Canadian film and television industry who needs 
            to track their income and expenses for tax purposes. This includes:
          </p>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
            <li>Actors and performers</li>
            <li>Directors and producers</li>
            <li>Crew members (cinematographers, sound engineers, editors, etc.)</li>
            <li>Self-employed industry professionals</li>
            <li>Incorporated professionals with corporate structures</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscription Tiers</CardTitle>
          <CardDescription>Choose the plan that fits your needs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">Basic</h3>
              <p className="text-sm text-muted-foreground">
                Perfect for tracking income and expenses. Includes receipt storage and basic financial overview.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">Personal</h3>
              <p className="text-sm text-muted-foreground">
                Everything in Basic, plus tax estimation tools for personal tax returns.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-2">Corporate</h3>
              <p className="text-sm text-muted-foreground">
                Full access to all features including T2 Corporate Tax Filing, dividend vs salary optimization, 
                and advanced tax planning tools.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax Compliance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">
            CrewBooks is designed to help you organize your financial information and estimate your tax obligations. 
            However, it's important to note that CrewBooks provides estimates and tools to assist with tax preparation, 
            but does not replace professional tax advice. We recommend consulting with a qualified tax professional 
            or accountant when filing your actual tax returns, especially for complex situations involving corporate 
            structures, multi-province work, or significant deductions.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Privacy & Security</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">
            Your financial data is important and sensitive. CrewBooks takes security seriously with encrypted data 
            storage and secure transmission. We're committed to protecting your privacy and ensuring your information 
            remains confidential. Your data is yours, and we never share it with third parties without your explicit 
            consent.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
