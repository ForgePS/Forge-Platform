import { Card, Badge } from "@forge/ui";

export default function HomePage() {
  return (
    <Card title="Forge Academy">
      <p>Foundation stage application shell. Business modules are not included in Sprint 1B.</p>
      <Badge>academy-web</Badge>
      <p>
        <a href="/health">Health</a>
      </p>
    </Card>
  );
}
