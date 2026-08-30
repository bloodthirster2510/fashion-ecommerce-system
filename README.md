# CDShop Fashion E-commerce System

Fashion E-commerce System is a fashion retail platform composed of a Mobile App, Customer Web, and Web Admin, all powered by a shared commerce backend and AI services for visual search, product recommendation, and virtual try-on.

The project targets an end-to-end fashion e-commerce workflow: customers need to discover relevant products, purchase quickly, and track orders clearly; store operators need one system to manage catalog, inventory, orders, promotions, support, and business data.

## Problem Statement

- Shorten the fashion shopping journey: search, filtering, product detail, cart, checkout, payment, order tracking, and post-purchase review.
- Improve product discovery through recommendations, interaction history, visual search, and virtual try-on.
- Standardize post-sale operations: orders, inventory, coupons, loyalty, reviews, customer support, notifications, and reporting.
- Separate customer-facing experiences from internal operations while keeping shared data, APIs, permissions, and realtime flows.

## Product Scope

### Mobile

The mobile app is built with Expo/React Native and focuses on frequent shopping flows on phone screens.

- Home, categories, search, filters, product detail, and recommendation rails.
- Cart, checkout, voucher application, COD/VNPay payment, order management, and delivery status.
- Account, addresses, payment methods, membership tier, favorites, reviews, and push notifications.
- Support center with FAQ, ticket creation, ticket tracking, and realtime socket updates.
- Virtual try-on: product selection, user photo upload, processing queue, result view, and try-on history.

### Web

The customer web app is built with React/Vite and serves as the browser-based shopping channel.

- Home, catalog, product detail, cart, checkout, orders, reviews, policies, and support.
- Shared authentication, cart, coupon, payment, shipping, and profile flows through the backend.
- Recommendation and interaction tracking for product discovery and behavior analysis.
- A customer layout separated from the admin area, keeping user roles clear within the same frontend repository.

### Web Admin

Web Admin is the operations portal for administrators and store staff.

- Dashboard for revenue, paid orders, average order value, returning customers, inventory risk, and pending operational tasks.
- Product, variant, category, brand, visual search index, and inventory management.
- Order operations, invoice lookup, payment, delivery, return, and reconciliation flows.
- Customer, admin account, permission, loyalty, coupon, campaign, and storefront settings management.
- Review moderation, support ticket handling, notification summary, virtual try-on monitoring, and recommendation/search reporting.

## System Architecture

><img width="1185" height="804" alt="image" src="https://github.com/user-attachments/assets/0bd77512-4c96-434e-9478-72a0f2f5188c" />


Main system flow:

- `mobile/` and `web_frontend/` call APIs through the Express/TypeScript backend.
- `backend/` owns auth, catalog, cart, order, payment, shipping, promotion, support, notification, recommendation, visual search, and virtual try-on logic.
- MongoDB stores business data; Redis/BullMQ handles asynchronous jobs; Socket.IO supports realtime order/support/try-on/notification updates.
- `ai_services/visual_search` generates image/text embeddings for visual search with CLIP/FashionCLIP.
- `ai_services/image-validation` validates user image quality before try-on.
- `ai_services/garment-processing` extracts garment regions and composes garment collages before sending them into the try-on workflow.

## Key Screens

> Insert a few representative screenshots here.
>
> Suggestion: include one Mobile screen, one Customer Web screen, one Web Admin dashboard screen, and one AI feature screen.

<!--
![Mobile app](docs/assets/screens/mobile-home.png)
![Web customer](docs/assets/screens/web-home.png)
![Web admin dashboard](docs/assets/screens/admin-dashboard.png)
![Virtual try-on](docs/assets/screens/virtual-try-on.png)
-->

## Technical Highlights

- Full-stack TypeScript across the backend and web frontend; React Native/Expo for mobile.
- Business-oriented backend modules: auth, catalog, inventory, cart, orders, payments, shipping, promotions, reviews, support, notifications, users, recommendations, visual search, and virtual try-on.
- Admin portal with permissions, audit logs, notification summaries, KPI dashboard, and real operational screens.
- AI services separated with FastAPI so they can scale independently from the commerce backend.
- Test coverage across multiple layers: backend Jest, web Playwright, Expo/Jest mobile tests, pytest for AI services, and offline benchmarks for recommendation/visual search.
- Docker Compose combines the backend, web app, and AI services into an integrated local environment.

## Roadmap

- Improve production readiness: CI/CD, observability, backups, rate limiting, security hardening, and more granular permissions.
- Expand recommendation and visual search with real behavior data, A/B testing, and CTR/conversion dashboards.
- Optimize virtual try-on for production: GPU inference, queue monitoring, image-type thresholds, and larger catalog benchmarks.
- Add deeper operational reporting: inventory forecasting, campaign performance, customer cohorts, and product-level profitability.
- Split deployment paths for Customer Web, Web Admin, and mobile releases if the system moves into real operation.

## Tech Stack

| Area | Main Technologies |
| --- | --- |
| Mobile | Expo, React Native, React Navigation, Socket.IO Client |
| Web / Admin | React, Vite, Redux Toolkit, TanStack Query, Ant Design, Playwright |
| Backend | Node.js, Express, TypeScript, Mongoose, JWT, BullMQ, Redis, Socket.IO |
| AI services | FastAPI, OpenCLIP/FashionCLIP, YOLO Pose, Grounding DINO, SAM |
| Integrations | VNPay, GHN Shipping, Cloudinary, email, Docker Compose |

## Repository Structure

```text
mobile/        Customer mobile app
web_frontend/  Customer Web and Web Admin
backend/       API, commerce logic, workers, and scripts
ai_services/   Visual search, image validation, garment processing
evaluation/    Recommendation and visual search benchmarks
docs/          Module documentation and implementation plans
ops/           Deployment scripts and systemd services
```

## Try-on development

From the backend folder, run the local try-on dev stack:

```powershell
cd backend
npm run dev:try-on
```

This starts the backend plus the local image validation and garment processing services. ComfyUI still needs to be opened separately when testing the real Comfy provider.
