# Reboot Earth production

Site: https://reboot.hollowdata.com/data/catalog

The application was deployed through SSH and the BeanCS V2 API. The canonical
repository is `zeturn/reboot-earth-proj`; upstream changes from
`SrutiElan/reboot-the-earth` were merged with their original author history.
The initial application image source revision is
`8d9b6487ba748efbac2b9aa7afc1d3f47e728a61`.

## Runtime

- Kubernetes namespace: `proj-reboot-earth`.
- BeanCS application: `dff701bc-a139-4de2-b39d-bf461c0be28e` (Reboot Earth).
- Production environment: `07c1d57b-04f2-4d15-8cc3-4984f105837d`.
- Application instance: `ad74d20f-7a43-47c2-b0c8-a5e9b5081142`.
- Deployments: `reboot-earth-frontend` (3000), `reboot-earth-backend` (8000).
- Database dependency: `reboot-earth-postgis` StatefulSet and private ClusterIP
  service, PostgreSQL 16 / PostGIS 3.4, persistent claim
  `reboot-earth-postgis-data` (5 GiB, `local-path`).
- Runtime pods are pinned to the amd64 worker `yuan-srv2`; do not move these
  single-architecture images to an ARM node.

Traefik sends `/api` to FastAPI and other paths to Next.js. HTTP redirects to
HTTPS. The `reboot-earth-tls` certificate renews through cert-manager's
`letsencrypt-prod-dns01` ClusterIssuer. Cloudflare DNS is proxied to the existing
cluster ingress. BeanCS tracks the project's ingress resources and DNS connection.

The site is intentionally public, including SQL, AI questions and contribution
imports. Queries use the restricted `ofo_reader` role, read-only transactions,
a five-second timeout and a 1,000-row result cap. Traefik limits general API traffic
to 120 requests/minute and AI/upload paths to 15 requests/minute per Cloudflare
client IP, with bursts of 40 and 5 respectively. These are abuse mitigations,
not authentication or a guarantee against model spending.

## Secrets

Never put credentials in Git, build arguments, image layers or browser variables.

- `app-env-vars-reboot-earth-backend`: `DATABASE_URL`, `OPENAI_API_KEY`,
  `OPENAI_MODEL=gpt-4.1-mini`, `OPENAI_BASE_URL=https://api.openai.com/v1`,
  `OPENAI_USE_RESPONSES_API=true`, `AI_MAX_ATTEMPTS=3`.
- `app-env-vars-reboot-earth-postgis`: separate database administrator and
  application passwords. The application logs in as `reboot_app`, not a superuser.
- `reboot-earth-registry` and BeanCS-managed image pull secrets: private registry
  access. Do not publish their contents.

There is no production Gemini key and no APICred dependency. After rotating the
OpenAI key in the backend Secret, restart only `deployment/reboot-earth-backend`.

## Updates

Push changes to `origin/main`. A Git push alone does **not** automatically deploy:
no automatic production trigger has been enabled.

Build images locally, not on the memory-constrained control node:

```bash
docker build --platform linux/amd64 -f frontend/Dockerfile.prod --build-arg NEXT_PUBLIC_API_URL= -t registry.beancs.com/tenant-2/reboot-earth-frontend:<commit> frontend
docker build --platform linux/amd64 -t registry.beancs.com/tenant-2/reboot-earth-backend:<commit> backend
```

Publish with unique commit tags. Resolve each image in BeanCS using
`POST /v2/artifacts/resolve` with the Harbor connection
`2c0c4124-7622-47f2-97ba-d3beb67ea4ea`, repository and immutable digest.
Supply **either** a digest **or** a tag, not both. Create a runtime configuration,
release and deployment run for the corresponding component. Preserve the existing
namespace, environment, instance ID, health checks and worker node selection.
Do not rebuild or reimport the database for normal application updates.

## Data and recovery

The initial import job, `reboot-earth-ofo-import`, used the backend image's
`python scripts/import_ofo.py`, without `--replace`. Verified initial contents:

- 287 plots in `ofo_plots`.
- 64,295 trees in `ofo_trees`.
- 687 missions in `ofo_drone_missions`.
- 974 catalog datasets.

Contributions are stored in the same persistent database. Normal image releases
preserve them. Do not delete the namespace or PVC to redeploy. Local-path storage
is single-node storage, not high availability or an off-site backup. Keep regular
database backups outside this node; the original GeoPackages do not include future
community submissions.

Example manual backup (run from an authenticated cluster administration shell):

```bash
kubectl -n proj-reboot-earth exec reboot-earth-postgis-0 -- sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > reboot-earth.dump
```

Useful diagnostics:

```bash
kubectl -n proj-reboot-earth get pods,pvc,ingress,certificate
kubectl -n proj-reboot-earth logs deployment/reboot-earth-backend --tail=50
kubectl -n proj-reboot-earth logs deployment/reboot-earth-frontend --tail=50
```

Verified after deployment: HTTPS pages, catalog counts, spatial SQL (trees within
100 m and no taller than 10 m), SQL write rejection, malformed upload rejection,
and a real OpenAI answer grounded in the database's 64,295-tree count.
