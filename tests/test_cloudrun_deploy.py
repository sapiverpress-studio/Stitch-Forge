"""Cloud Run alternative cannot silently create resources or incur cloud costs."""
import os
from pathlib import Path
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/"services/digitiser/deploy-cloud-run-staging.sh"
SHA="a"*40

class CloudRunDeployGuardTests(unittest.TestCase):
    def run_script(self,args=(),changes=None):
        env={**os.environ,
             "GOOGLE_CLOUD_PROJECT":"sapiver-staging",
             "CLOUD_RUN_REGION":"europe-west2",
             "CLOUD_RUN_REPOSITORY":"stitch-forge-staging",
             "STITCH_FORGE_CLOUD_SECRET":"stitch-forge-worker-token",
             "STITCH_FORGE_DEPLOY_COMMIT":SHA,
             "CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT":"worker@sapiver-staging.iam.gserviceaccount.com"}
        env.pop("STITCH_FORGE_CLOUD_BILLING_APPROVED",None)
        env.update(changes or {})
        return subprocess.run(["bash",str(SCRIPT),*args],cwd=ROOT,
                              capture_output=True,text=True,env=env,timeout=10)

    def test_default_is_dry_run_with_exact_private_dev_image(self):
        r=self.run_script()
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertIn("DRY RUN ONLY",r.stdout)
        self.assertIn("europe-west2-docker.pkg.dev/sapiver-staging/stitch-forge-staging/stitch-forge-worker:"+SHA,r.stdout)
        self.assertIn("--min-instances 0",r.stdout)
        self.assertIn("--max-instances 1",r.stdout)
        self.assertIn("--memory 2Gi",r.stdout)
        self.assertIn("--no-allow-unauthenticated",r.stdout)
        self.assertNotIn("--allow-unauthenticated ",r.stdout)
        self.assertIn("DRY RUN ONLY",r.stdout)

    def test_execute_requires_explicit_cost_approval_before_gcloud(self):
        r=self.run_script(["--execute"])
        self.assertEqual(r.returncode,3)
        self.assertIn("REFUSED",r.stderr)

    def test_rejects_missing_identifiers_and_command_injection(self):
        for changes in [
            {"GOOGLE_CLOUD_PROJECT":""},
            {"CLOUD_RUN_REPOSITORY":"bad; echo leaked"},
            {"CLOUD_RUN_REGION":"invalid"},
            {"STITCH_FORGE_CLOUD_SECRET":""},
            {"STITCH_FORGE_DEPLOY_COMMIT":"main"},
            {"CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT":""}]:
            with self.subTest(changes=changes):
                r=self.run_script(changes=changes)
                self.assertEqual(r.returncode,2)
                self.assertNotIn("DRY RUN ONLY",r.stdout)

    def test_rejects_wrong_branch_even_with_explicit_cost_flag(self):
        # Must fail before gcloud (CI has no gcloud). Works on a detached HEAD
        # or any branch other than exact Stitch Forge development branch.
        r=self.run_script(["--execute"],
           {"STITCH_FORGE_CLOUD_BILLING_APPROVED":"yes-for-this-staging-deploy"})
        self.assertEqual(r.returncode,3)
        self.assertIn("REFUSED",r.stderr)
