import test from 'node:test';import assert from 'node:assert/strict';import {performance,localDay} from './performance.js';
test('drawdown includes initial capital baseline and uses chronological trades',()=>{const m=performance([{date:'2026-10-03',pnl:-40},{date:'2026-10-01',pnl:-100},{date:'2026-10-02',pnl:150}]);assert.equal(m.pnl,10);assert.equal(m.maxDrawdown,100);assert.equal(m.curve[1].pnl,-100);assert.equal(m.profitFactor,150/140);});
test('empty and no-loss samples are distinct',()=>{assert.equal(performance([]).profitFactor,null);assert.equal(performance([{date:'2026-10-01',pnl:10}]).profitFactor,Infinity);assert.equal(performance([]).expectancy,null);});
test('daily totals preserve breakeven trades and numeric strings',()=>{const m=performance([{date:'2026-10-01',pnl:'20'},{date:'2026-10-01',pnl:-20},{date:'2026-10-02',pnl:0}]);assert.deepEqual(m.daily['2026-10-01'],{pnl:0,count:2});assert.equal(m.rows.length,3);assert.ok(Math.abs(m.winRate-100/3)<1e-10);});
test('local date retains calendar components',()=>assert.equal(localDay(new Date(2026,9,23,0,1)),'2026-10-23'));

test('missing results are not counted as breakeven trades',()=>assert.equal(performance([{pnl:null},{pnl:''},{pnl:undefined},{pnl:0,date:'2026-10-01'}]).rows.length,1));
