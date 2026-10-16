import math
import unittest
from elements import _robot_collision, _local, _world, resolve_launch, update_elements
from server import Session

class ReportCollisionTests(unittest.TestCase):
    def test_inside_chassis_resolved_in_one_step_at_rotations(self):
        for yaw in [0, 35, 90, -125]:
            for lx,ly in [(0,0),(.1,.02),(-.1,-.12)]:
                s=Session({'x':1.8,'y':1.8,'yaw':yaw});w=s.world
                p=next(p for p in w.elements if p.status=='field')
                dx,dy=_world(lx,ly,w.yaw);p.x,p.y=w.x+dx,w.y+dy
                _robot_collision(w,p,(0,0))
                ex,ey=_local(p.x-w.x,p.y-w.y,w.yaw)
                # Distância independente do centro ao retângulo mais próximo.
                distance=math.hypot(max(0,abs(ex)-w.width/2),max(0,abs(ey)-w.length/2))
                self.assertAlmostEqual(distance,p.radius)
                expected=min(w.width/2-abs(lx),w.length/2-abs(ly))+p.radius
                self.assertAlmostEqual(math.hypot(ex-lx,ey-ly),expected)

    def test_garden_reset_does_not_push_through_field_wall(self):
        s=Session({'x':.4,'y':.225});w=s.world
        ids={p.id for p in w.elements};w.step(.01)
        for p in w.elements:
            if p.status!='field':continue
            dx=max(0,abs(p.x-w.x)-w.width/2);dy=max(0,abs(p.y-w.y)-w.length/2)
            self.assertGreaterEqual(math.hypot(dx,dy),p.radius-1e-9)
            self.assertGreaterEqual(p.y,p.radius)
            self.assertGreaterEqual(p.x,p.radius)
        self.assertEqual(ids,{p.id for p in w.elements})
        self.assertEqual(len(w.inventory),4)

    def test_missed_reclassified_once_and_pending_remains_explicit(self):
        s=Session({'launcher':{'shot-mode':'speed','speed':1,'elevation':0}});w=s.world
        w.motors['MI'].power=w.motors['MS'].power=1
        w.elapsed=.8;update_elements(w,.01)
        p=next(p for p in w.elements if p.status=='launched')
        self.assertEqual(w.snapshot()['launcher_status']['pending'],1)
        w.motors['MI'].power=w.motors['MS'].power=0
        w.elapsed+=1;update_elements(w,.01)
        self.assertEqual((w.launch_hits,w.launch_misses),(0,1))
        self.assertEqual(w.snapshot()['launcher_status']['pending'],0)
        self.assertFalse(resolve_launch(w,p.id,p.launch_id,'missed')['changed'])
        resolve_launch(w,p.id,p.launch_id,'scored',1.5,1.5)
        self.assertEqual((w.launch_hits,w.launch_misses),(1,0))
        self.assertFalse(resolve_launch(w,p.id,p.launch_id,'scored',1.5,1.5)['changed'])
        self.assertEqual(w.snapshot()['launcher_status']['pending'],0)

if __name__=='__main__':unittest.main()
