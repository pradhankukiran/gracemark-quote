'use client'

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <main className="container mx-auto px-6 py-8 max-w-3xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-600 hover:text-primary transition-all duration-200 hover:gap-3 font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </Link>
        </div>

        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">
              Something went wrong with the IC calculator
            </h2>
            <p className="text-slate-600 break-words">
              {error.message || "An unexpected error occurred."}
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button onClick={reset}>Try again</Button>
              <Link href="/">
                <Button variant="outline">Go home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
