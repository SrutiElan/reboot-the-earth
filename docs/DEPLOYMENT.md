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

## CI/CD: release by pushing a tag

Pull requests and pushes to `main` run CI. **Every pushed tag** triggers
`.github/workflows/release.yml`, using the exact tagged commit, not the moving
`main` branch. Creating a tag only on your laptop is not enough; push it:

```bash
git switch main
git pull --ff-only origin main
git tag -a v0.1.1 -m "Release v0.1.1"
git push origin v0.1.1
```

Use a new, unique tag for each release. Tags must point to commits that include
the release workflow. Tags from other branches and prerelease tags also deploy
to **production**, so tag only code you intend to publish. GitHub workflow
concurrency queues releases (up to 100 pending runs) without canceling one that
is already running.

The automatic chain is:

1. Import source data into a disposable CI PostGIS service and run backend tests,
   deployment safety tests, frontend lint and a production frontend build.
2. Build amd64 images on GitHub-hosted runners, using this repository's GitHub
   Actions billing. The control node does not build application images.
3. Push unique run/attempt image tags to the private Harbor project
   `reboot-earth-proj` (`backend` and `frontend` repositories).
4. Resolve immutable image digests through BeanCS, reuse the previous successful
   runtime configuration, then roll out backend and frontend sequentially.
5. Verify public HTTPS pages, SQL data counts and the server-side OpenAI
   configuration without spending model tokens. If rollout or verification
   fails, request rollback to the previous successful releases and fail the run.

BeanCS's native rollout readiness window is two minutes. First-time image pulls
can exceed it, so the workflow retries a reported rollout timeout up to twice,
reapplying the same immutable release without restarting its downloading pod.
Other deployment errors fail immediately; persistent timeouts still roll back.

Track progress in [GitHub Actions](https://github.com/zeturn/reboot-earth-proj/actions)
and BeanCS deployment history. Successful workflow summaries include the exact
commit, image digests and BeanCS release IDs. Database volumes, secrets and user
contributions are not rebuilt, reimported or deleted by this pipeline. Releases
must remain backward-compatible with the current database; destructive schema
migrations are deliberately outside this automatic workflow.

`deploy/production.json` contains non-secret target IDs. The artifact connection
is `ee14ae4f-80b9-4a26-8f6f-8245512a5af6`, backed by a pull-only credential for
this project's registry. Existing Kubernetes worker node selection is preserved.

### CI credentials and rotation

The GitHub `production` environment accepts tag deployments only and contains:

- `BEANCS_API_KEY`: `applications:read`, `deployments:read`, `deployments:write`;
  no administrator, runtime, API-key management or credential-read privileges.
  BeanCS currently scopes this token to tenant 2 rather than an individual app;
  do not share it outside this repository's trusted release workflow.
- `REGISTRY_USERNAME` / `REGISTRY_PASSWORD`: a robot restricted to pull/push
  in `reboot-earth-proj`, with no access to other registry projects.
- Repository variable `BEANCS_API_URL=https://beancs.com` (not secret).

The CI token and dedicated registry robots expire on 24 October 2027. Rotate them
before expiry. The runtime pull robot is stored encrypted in BeanCS, not GitHub;
rotate it there and refresh the deployment pull secrets as well. No SSH password,
kubeconfig, registry administrator password or OpenAI key is copied to Actions.
Actions are pinned to verified commit SHAs; review updates before changing them.

Manual recovery still uses BeanCS release rollback. If the management API itself
is unavailable, a workflow cannot guarantee rollback; restore API connectivity
and inspect the failed workflow and cluster before retrying. Never delete the
database namespace or PVC as a release recovery step.

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
