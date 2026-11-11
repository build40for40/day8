import { DurableObject } from "cloudflare:workers";

export class AlarmSpike extends DurableObject {
  async log(event, extra = {}) {
    const log = (await this.ctx.storage.get("log")) ?? [];
    log.push({ at: new Date().toISOString(), event, ...extra });
    await this.ctx.storage.put("log", log);
    console.log(this.ctx.id.name ?? "spike", event, JSON.stringify(extra));
  }

  async start(config) {
    await this.ctx.storage.put("config", config);
    await this.ctx.storage.put("log", []);
    await this.ctx.storage.setAlarm(Date.now());
  }

  async poke() {
    const seen = await this.ctx.storage.getAlarm();
    await this.ctx.storage.setAlarm(Date.now());
    await this.log("poke", { getAlarmBeforeSet: seen });
  }

  readLog() {
    return this.ctx.storage.get("log");
  }

  async alarm(info) {
    const config = await this.ctx.storage.get("config");
    const run = crypto.randomUUID().slice(0, 4);
    const started = Date.now();
    await this.log("alarm start", { run, retryCount: info?.retryCount, isRetry: info?.isRetry });
    if (config.mode === "throw") {
      await this.log("alarm throwing", { run });
      throw new Error("spike failure");
    }
    const steps = config.steps ?? 1;
    for (let step = 1; step <= steps; step++) {
      const response = await fetch(`${this.env.UPSTREAM}/slow?ms=${Math.round(config.ms / steps)}`);
      await response.text();
      await this.log("upstream returned", { run, step, status: response.status });
    }
    await this.log("alarm end", { run, seconds: Math.round((Date.now() - started) / 1000) });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get("id") ?? "default";
    const stub = env.SPIKE.get(env.SPIKE.idFromName(id));
    if (url.pathname === "/start") {
      await stub.start({
        mode: url.searchParams.get("mode") ?? "slow",
        ms: Number(url.searchParams.get("ms") ?? 30000),
        steps: Number(url.searchParams.get("steps") ?? 1),
      });
      return new Response("started\n");
    }
    if (url.pathname === "/poke") {
      await stub.poke();
      return new Response("poked\n");
    }
    if (url.pathname === "/log") return Response.json(await stub.readLog());
    return new Response("not found\n", { status: 404 });
  },
};
