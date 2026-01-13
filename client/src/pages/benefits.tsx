import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function BenefitsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Benefits</h1>
        <p className="text-muted-foreground">Tools and perks to help you save time and money</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>We're building this feature. Check back shortly.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Feature coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}
