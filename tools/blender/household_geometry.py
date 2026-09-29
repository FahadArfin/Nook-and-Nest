"""Stable closed circular sweep for the household model authoring modules."""
import math
from build_kitchen_essentials import tube

def ring(name,center,radius,thickness,mat,axis='Z',steps=48):
 points=[]
 for i in range(steps+1):
  a=i*math.tau/steps;u=radius*math.cos(a);v=radius*math.sin(a)
  points.append((center[0]+(0 if axis=='X' else u),
                 center[1]+(u if axis=='X' else v if axis=='Z' else 0),
                 center[2]+(v if axis!='Z' else 0)))
 return tube(name,points,thickness,mat,8)
