# Kroxt BaaS SDK

Official JavaScript and TypeScript SDK for Kroxt BaaS.

## Installation

```bash
npm install @kroxt/baas-sdk
```

## Quick Start

Create a client with your project ID and API key:

```js
import Kroxt from "@kroxt/baas-sdk";

const kroxt = new Kroxt({
  baseUrl: "https://api.example.com",
  projectId: "PROJECT_ID",
  apiKey: "PROJECT_API_KEY",
});

const posts = await kroxt.collection("posts").limit(10).get();
```

## Authentication

Sign a user in:

```js
await kroxt.auth.login({
  email: "user@example.com",
  password: "password",
});
```

Read the active user session:

```js
const user = await kroxt.auth.me();
```

Sign out:

```js
await kroxt.auth.logout();
```

Register a project user:

```js
await kroxt.auth.register({
  email: "user@example.com",
  password: "password",
  displayName: "Ada",
});
```

## Collections

Create a document:

```ts
type Post = {
  title: string;
  published: boolean;
  views: number;
};

const posts = kroxt.collection<Post>("posts");

const created = await posts.create({
  title: "Hello Kroxt",
  published: true,
  views: 1,
});
```

Query documents:

```ts
const posts = kroxt.collection<Post>("posts");

const publishedPosts = await posts
  .where("published", true)
  .where("views", "greaterThan", 10)
  .orderBy("createdAt", "desc")
  .limit(20)
  .get();
```

Update or delete a document:

```ts
await posts.update(created._id, { views: 2 });
await posts.delete(created._id);
```

## Pagination

```js
const page = await kroxt.collection("posts").paginate({
  page: 1,
  limit: 20,
});

console.log(page.items, page.total, page.hasNext);
```

## Realtime

Subscribe to collection changes:

```js
const channel = kroxt.realtime.collection("posts");

channel
  .subscribe()
  .on("created", (post) => {
    console.log("New post:", post);
  });
```

Use custom realtime channels:

```js
kroxt.realtime
  .channel("room:lobby")
  .subscribe()
  .on("message", (payload) => {
    console.log(payload);
  });
```

## Storage and Functions

Upload a file:

```js
const uploaded = await kroxt.storage.upload(file);
```

Invoke a serverless function:

```js
const result = await kroxt.functions.invoke("send-welcome-email", {
  userId: "USER_ID",
});
```

## Configuration

```js
const kroxt = new Kroxt({
  projectId: "PROJECT_ID",
  apiKey: "PROJECT_API_KEY",
  baseUrl: "https://api.example.com",
  timeout: 30000,
  retries: 3,
  autoRefresh: true,
  debug: false,
});
```

## Package Formats

This package ships CommonJS, ESM, and TypeScript declarations.

```js
import Kroxt from "@kroxt/baas-sdk";
```

```js
const { Kroxt } = require("@kroxt/baas-sdk");
```

## License

MIT
