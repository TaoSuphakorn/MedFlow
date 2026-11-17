# Docker CI

The `Docker verification` workflow in `.github/workflows/docker-ci.yml` runs on pushes, pull requests and manual dispatch. It uses the same Dockerfiles and test services as the local demonstration. It does not install Node.js, .NET, EF CLI or PostgreSQL on the runner.

## What it checks

1. Compose configuration and Docker availability.
2. Image builds, service health and startup from fresh database volumes.
3. Automatic migration and seed counts: three users, 15 patients, 45 confirmed notes, one AI draft and one migration.
4. Backend integration tests, including validation, authorization, confirmation, audit rollback and repeated seeding.
5. Real browser workflows in Thai and English, using deterministic Demo AI.
6. Record counts and a checksum of all stored note fields before and after restarting the application services.

The PostgreSQL comparison checksum detects changes during the test. It is not a tamper-proof audit or cryptographic integrity control.

## Isolation and reports

`docker/ci.override.yml` uses a separate Compose project, fixed CI-only database/demo credentials and an explicitly empty OpenAI key. It removes all published application ports. Tests communicate through the internal Docker network. The running local demo and its database are separate.

The workflow grants read access to repository contents, disables persistence of checkout credentials, pins official actions to verified commits and sets a 25-minute job limit. Reports and Docker diagnostics upload even if a test fails, with seven-day retention. Cleanup removes the disposable CI containers and volumes.

Artifacts are written under the ignored `artifacts/ci/` directory:

- `backend/backend.trx`: xUnit/VSTest results.
- `playwright-report/`: browser HTML report.
- `playwright-results/`: failure screenshots and traces.
- `screenshots/`: generated UI screenshots, separate from tracked README images.
- `services.txt` and `compose.log`: service status and diagnostics.

## Reproduce locally

Use Docker Compose 2.24.4 or newer for override-file merge tags. These commands create a disposable project named `medflow-ci`; they do not use the default demonstration project.

```bash
docker compose -p medflow-ci -f docker-compose.yml -f docker/ci.override.yml up --build -d --wait
```

Before running tests, verify the fresh seed. In Bash:

```bash
ci() { docker compose -p medflow-ci -f docker-compose.yml -f docker/ci.override.yml "$@"; }
counts=$(ci exec -T postgres psql -U medflow -d medflow -At < docker/ci/seed-counts.sql)
test "$counts" = '3|15|45|1|1'
```

In PowerShell:

```powershell
$ciArgs = @('-p', 'medflow-ci', '-f', 'docker-compose.yml', '-f', 'docker/ci.override.yml')
$counts = Get-Content -Raw docker/ci/seed-counts.sql | docker compose @ciArgs exec -T postgres psql -U medflow -d medflow -At
if ($counts -ne '3|15|45|1|1') { throw "Unexpected seed counts: $counts" }
```

The fourth count is specifically an unapproved AI SOAP draft. Run the test suites:

```bash
docker compose -p medflow-ci -f docker-compose.yml -f docker/ci.override.yml --profile test run --build --rm backend-tests
docker compose -p medflow-ci -f docker-compose.yml -f docker/ci.override.yml --profile test run --build --rm e2e
```

Then compare all note fields and counts across a restart. In Bash, using the `ci` function above:

```bash
before=$(ci exec -T postgres psql -U medflow -d medflow -At < docker/ci/record-snapshot.sql)
ci restart postgres backend frontend
ci up -d --wait --wait-timeout 180
after=$(ci exec -T postgres psql -U medflow -d medflow -At < docker/ci/record-snapshot.sql)
test "$before" = "$after"
```

In PowerShell, using `$ciArgs` above:

```powershell
$before = Get-Content -Raw docker/ci/record-snapshot.sql | docker compose @ciArgs exec -T postgres psql -U medflow -d medflow -At
docker compose @ciArgs restart postgres backend frontend
docker compose @ciArgs up -d --wait --wait-timeout 180
$after = Get-Content -Raw docker/ci/record-snapshot.sql | docker compose @ciArgs exec -T postgres psql -U medflow -d medflow -At
if ($before -ne $after) { throw 'Stored records changed after restart' }
```

After reviewing reports, remove that test project:

```bash
docker compose -p medflow-ci -f docker-compose.yml -f docker/ci.override.yml --profile test down --volumes --remove-orphans
```

This deletes only the disposable `medflow-ci` project volumes. Run cleanup before repeating the fresh-seed check, because completed browser tests intentionally create synthetic records in the CI database.

To validate the Actions workflow syntax without installing a host tool:

```bash
docker run --rm -v "${PWD}:/repo" -w /repo rhysd/actionlint:1.7.12 .github/workflows/docker-ci.yml
```

`${PWD}` works in Bash and PowerShell. Run from the repository root.

## Verification boundary

The Compose configuration, image builds, test commands, generated reports, fresh seed and restart persistence checks are reproducible locally. An actual GitHub-hosted run still requires pushing to a repository with Actions enabled. No repository was published and no hosted workflow was triggered during implementation. GitHub account permissions, runner availability and artifact upload on GitHub remain unverified until that first run.

## References

- [Docker Compose merge and reset rules](https://docs.docker.com/reference/compose-file/merge/)
- [Official checkout action](https://github.com/actions/checkout/releases/tag/v7.0.1)
- [Official artifact upload action](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)
