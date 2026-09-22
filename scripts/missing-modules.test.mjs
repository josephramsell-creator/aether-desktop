import test from "node:test";
import assert from "node:assert/strict";
import { isMigrationFile, pendingMigrations } from "./migration-plan.mjs";
import { runSignOut, runPreSignInSignOut } from "./sign-out-plan.mjs";

test("migration plan orders unapplied SQL and excludes opt-in auth", () => {
  const paths = ["/migrations/003.sql", "/migrations/auth/001.sql", "/migrations/001.sql", "/migrations/002.sql", "/migrations/README.md"];
  assert.deepEqual(pendingMigrations(paths, ["001.sql"]), [
    {name:"002.sql", path:"/migrations/002.sql"}, {name:"003.sql", path:"/migrations/003.sql"},
  ]);
  assert.equal(isMigrationFile("auth/001.sql"), false);
  assert.equal(isMigrationFile("001.sql"), true);
  assert.deepEqual(pendingMigrations(["C:\\app\\migrations\\001.sql"], []), [{name:"001.sql",path:"C:\\app\\migrations\\001.sql"}]);
  assert.throws(() => pendingMigrations(["001.sql", "/migrations/001.sql"], []), /Duplicate/);
});

test("successful sign-out confirms server before clear and redirect", async () => {
  const order=[];
  await runSignOut({livePreview:false,hasBearer:true,requestSignOut:async()=>{order.push("server")},clearToken:()=>order.push("clear"),redirect:()=>order.push("redirect")});
  assert.deepEqual(order,["server","clear","redirect"]);
});

for (const failure of [() => Promise.reject(new Error("offline")), async () => ({error:{message:"denied"}}), () => new Promise(()=>{})]) {
  test("deployed failure/timeout blocks redirect and new sign-in", async () => {
    let redirected=false, cleared=0;
    const options={livePreview:false,timeoutMs:5,requestSignOut:failure,clearToken:()=>{cleared++}};
    await assert.rejects(runSignOut({...options,redirect:()=>{redirected=true}}));
    await assert.rejects(runPreSignInSignOut(options));
    assert.equal(redirected,false);assert.equal(cleared,2);
  });
  test("preview failure/timeout still clears local session", async () => {
    let redirected=false, cleared=0;
    await runSignOut({livePreview:true,timeoutMs:5,requestSignOut:failure,clearToken:()=>{cleared++},redirect:()=>{redirected=true}});
    assert.equal(redirected,true);assert.equal(cleared,1);
  });
}
