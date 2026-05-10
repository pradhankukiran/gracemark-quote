import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, UserCheck } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-6 py-10 max-w-4xl">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center mb-12">
          <div className="mb-3 flex flex-col items-center">
            <Image
              src="/GraceMarklogo.png"
              alt="GraceMark Logo"
              width={200}
              height={82}
              priority
              className="block"
            />
          </div>
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary uppercase tracking-widest mb-6">
            Internal Tool
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-3">
            Quote Calculator
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
            Select the type of engagement below to generate a tailored, accurate quote across our provider network.
          </p>
        </div>

        {/* Service Selection */}
        <div className="grid md:grid-cols-2 gap-12 mb-20">
          {/* EOR Card */}
          <Card className="group border-0 shadow-none hover:shadow-lg transition-all duration-300 bg-gray-50 hover:bg-white">
            <CardContent className="p-12 text-center">
              <div className="mb-8">
                <div className="w-16 h-16 bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <h2 className="font-serif text-3xl font-bold mb-4">Employer of Record (EOR)</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Full employment services including payroll, benefits, and compliance management.
                </p>
              </div>
              <Link href="/eor-calculator">
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-4 text-lg cursor-pointer"
                >
                  Calculate EOR Quote
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* IC Card */}
          <Card className="group border-0 shadow-none hover:shadow-lg transition-all duration-300 bg-gray-50 hover:bg-white">
            <CardContent className="p-12 text-center">
              <div className="mb-8">
                <div className="w-16 h-16 bg-accent/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-accent/20 transition-colors">
                  <UserCheck className="h-8 w-8 text-accent" />
                </div>
                <h2 className="font-serif text-3xl font-bold mb-4">Independent Contractor (IC)</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Streamlined contractor management and payment processing solutions.
                </p>
              </div>
              <Link href="/ic-calculator">
                <Button
                  size="lg"
                  className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-4 text-lg cursor-pointer"
                >
                  Calculate IC Quote
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
