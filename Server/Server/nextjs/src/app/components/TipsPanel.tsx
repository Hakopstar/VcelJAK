import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ScrollArea } from "~/components/ui/scroll-area"
import { Badge } from "~/components/ui/badge"
import { useSSE } from "./SSEProvider";

/*const tips = [
  {
    title: "Regular Inspections",
    description: "Conduct weekly hive inspections to check for signs of disease, pests, or queen issues.",
    priority: "High",
  },
  {
    title: "Water Source",
    description: "Provide a clean, shallow water source near the hive to prevent bees from seeking water elsewhere.",
    priority: "Medium",
  },
  {
    title: "Diverse Plantings",
    description: "Plant a variety of nectar-rich flowers to ensure a consistent food supply throughout the season.",
    priority: "Medium",
  },
  {
    title: "Temperature Control",
    description: "Monitor hive temperature and provide adequate ventilation to maintain optimal conditions.",
    priority: "High",
  },
  {
    title: "Record Keeping",
    description: "Maintain detailed records of hive health, honey production, and queen performance for each colony.",
    priority: "Medium",
  },
  {
    title: "Responsible Harvesting",
    description: "Only harvest excess honey, ensuring bees have enough stores for winter survival.",
    priority: "High",
  },
  {
    title: "Pest Management",
    description: "Implement integrated pest management techniques to control varroa mites and other pests.",
    priority: "High",
  },
  {
    title: "Equipment Maintenance",
    description: "Regularly clean and maintain beekeeping equipment to prevent disease spread and ensure longevity.",
    priority: "Medium",
  },
  {
    title: "Stay Informed",
    description:
      "Keep up-to-date with local beekeeping regulations and best practices through workshops and associations.",
    priority: "Low",
  },
  {
    title: "Swarm Prevention",
    description: "Monitor for signs of swarming and take preventive measures like adding supers or splitting hives.",
    priority: "High",
  },
]
*/



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

