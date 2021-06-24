# netpolTest
Kubernetes Policies without context



Allowing any pod to talk to Kube DNS to prevent scenarios where you break traffic
```
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: security.allow-kube-dns
spec:
  tier: security
  order: 155
  selector: ''
  namespaceSelector: ''
  serviceAccountSelector: ''
  egress:
    - action: Allow
      source: {}
      destination:
        selector: k8s-app == "kube-dns"
    - action: Pass
      source: {}
      destination: {}
  doNotTrack: false
  applyOnForward: false
  preDNAT: false
  types:
    - Egress
```

I recommend running this in the 'security' tier of Calico Enterprise, if you are taking a shift-left approach:
```
kubectl apply -f allow-kube-dns.yaml
```
