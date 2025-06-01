import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Badge } from "~/components/ui/badge"
import { useSSE } from "./SSEProvider";


const priorityColors = {
  High: "bg-red-500",
  Medium: "bg-yellow-500",
  Low: "bg-green-500",
}

export default function TipsPanel() {
  const { tips } = useSSE();
  return (
    <Card className="bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/50 hover:border-2 hover:border-primary">
      <CardHeader>
        <CardTitle className="text-xl">Beekeeping Tips</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <ul className="space-y-4">
            {tips.map((tip, index) => (
              <li key={index} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-primary">{tip.title}</h3>
                  <Badge className={`${priorityColors[tip.priority as keyof typeof priorityColors]} text-background`}>
                    {tip.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{tip.description}</p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

