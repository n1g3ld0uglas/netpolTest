# Network Policy Test
Using this repo as a sandbox for any K8 testing - not the be used for workshops<br/>
<br/>
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

## Calico OS test application

Deploy a demo application

```
kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/microservices-demo/master/release/kubernetes-manifests.yaml
```

Deploy boutiqueshop policies

```
kubectl apply -f https://raw.githubusercontent.com/tigera-solutions/tigera-eks-workshop/main/demo/boutiqueshop/policies.yaml
```

## RBAC SA's for CaliEnt

Nigel:

```
kubectl get secret $(kubectl get serviceaccount nigel -o jsonpath='{range .secrets[*]}{.name}{"\n"}{end}' | grep token) -o go-template='{{.data.token | base64decode}}' && echo
```

Taher:

```
kubectl get secret $(kubectl get serviceaccount taher -o jsonpath='{range .secrets[*]}{.name}{"\n"}{end}' | grep token) -o go-template='{{.data.token | base64decode}}' && echo
```

## Global Alert Test (work in progress)

```
kubectl apply -f - <<EOF
apiVersion: projectcalico.org/v3
kind: GlobalAlert
metadata:
 name: frequent-dns-responses
spec:
 description: "Monitor for NXDomain"
 summary: "Observed ${sum} NXDomain responses for ${qname}"
 severity: 100
 dataSet: dns
 query: rcode = NXDomain 
 aggregateBy: 
 - qname
 field: count
 metric: sum
 condition: gte
 threshold: 1
EOF
```

## Host Endpoint Test not working

#### EKS:
```
spec:
  tier: security
  order: 100
  selector: host-end-point == "test"
  # Allow all traffic to localhost.
  ingress:
  - action: Allow
    destination:
      nets:
      - 127.0.0.1/32
  # Allow node port access only from specific CIDR.
  - action: Deny
    protocol: TCP
    source:
      notNets:
      - ${PUB_IP}
    destination:
      ports:
      - 30080
  doNotTrack: false
  applyOnForward: true
  preDNAT: true
  types:
    - Ingress
```

#### AKS:
```
spec:
  tier: security
  order: 100
  selector: host-end-point == "test"
  # Allow all traffic to localhost.
  ingress:
  - action: Allow
    destination:
      nets:
      - 127.0.0.1/32
  # Deny node port access from specific CIDR.
  - action: Deny
    protocol: TCP
    source:
      nets:
      - {PRV_IP}
    destination:
      ports:
      - 30080
  doNotTrack: false
  applyOnForward: true
  preDNAT: true
  types:
    - Ingress
```
