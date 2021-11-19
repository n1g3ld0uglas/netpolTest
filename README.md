# Calico Network Policy Testing
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

## Set policy to allow external traffic for cluster IPs
Add rules to allow the external traffic for each clusterIP. <br/>
The following example allows connections to two cluster IPs. <br/>
Make sure you add ```applyOnForward``` and ```preDNAT``` rules.

```
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: allow-cluster-ips
spec:
  selector: k8s-role == 'node'
  types:
  - Ingress
  applyOnForward: true
  preDNAT: true
  ingress:
  # Allow 50.60.0.0/16 to access Cluster IP A
  - action: Allow
    source:
      nets:
      - 50.60.0.0/16
    destination:
      nets:
      - 10.20.30.40/32 # Cluster IP A
  # Allow 70.80.90.0/24 to access Cluster IP B
  - action: Allow
    source:
      nets:
      - 70.80.90.0/24
    destination:
      nets:
      - 10.20.30.41/32 # Cluster IP B
```

## Add a rule to allow traffic destined for the pod CIDR
Without this rule, normal pod-to-pod traffic is blocked because the policy applies to forwarded traffic.

```
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: allow-to-pods
spec:
  selector: k8s-role == 'node'
  types:
  - Ingress
  applyOnForward: true
  preDNAT: true
  ingress:
  # Allow traffic forwarded to pods
  - action: Allow
    destination:
      nets:
      - 192.168.0.0/16 # Pod CIDR
```

## Add a rule to allow traffic destined for all host endpoints
Or, you can add rules that allow specific host traffic including Kubernetes and Calico. <br/>
Without this rule, normal host traffic is blocked.

```
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: allow-traffic-hostendpoints
spec:
  selector: k8s-role == 'node'
  types:
  - Ingress
  # Allow traffic to the node (not nodePorts, TCP)
  - action: Allow
    protocol: TCP
    destination:
      selector: k8s-role == 'node'
      notPorts: ["30000:32767"] # nodePort range
  # Allow traffic to the node (not nodePorts, UDP)
  - action: Allow
    protocol: UDP
    destination:
      selector: k8s-role == 'node'
      notPorts: ["30000:32767"] # nodePort range
```

## Create a global network policy that selects pods
In this step, you create a GlobalNetworkPolicy that selects the same set of pods as your Kubernetes Service. <br/>
Add rules that allow host endpoints to access the service ports.

```
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: allow-nodes-svc-a
spec:
  selector: k8s-svc == 'svc-a'
  types:
  - Ingress
  ingress:
  - action: Allow
    protocol: TCP
    source:
      selector: k8s-role == 'node'
    destination:
      ports: [80, 443]
  - action: Allow
    protocol: UDP
    source:
      selector: k8s-role == 'node'
    destination:
      ports: [80, 443]
```


## Create HostEndpoints for the above Policy Configurations
Create HostEndpoints for the interface of each host that will receive traffic for the clusterIPs. <br/>
Be sure to label them so they are selected by the policy in Step 2 <br/>
(Add a rule to allow traffic destined for the pod CIDR), and the rules in Step 3.

```
kubectl patch kubecontrollersconfiguration default --patch='{"spec": {"controllers": {"node": {"hostEndpoint": {"autoCreate": "Enabled"}}}}}'
```

If successful, host endpoints are created for each of your cluster’s nodes:
```
kubectl get heps -o wide
```

For example, to add the label kubernetes-host to all nodes and their host endpoints:
```
kubectl label nodes --all kubernetes-host=
```
In the previous example policies, the label ```k8s-role: node``` is used to identify these HostEndpoints.
```
kubectl label node node1 k8s-role=node
```

![host-forward-traffic](https://user-images.githubusercontent.com/82048393/142612074-0534815f-d510-4e65-8f67-40d42df8afde.png)



## Calico OSS Test Application

Deploy a demo application

```
kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/microservices-demo/master/release/kubernetes-manifests.yaml
```

Deploy boutiqueshop policies

```
kubectl apply -f https://raw.githubusercontent.com/tigera-solutions/tigera-eks-workshop/main/demo/boutiqueshop/policies.yaml
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

## Host Endpoint Test Not Working

In which circumstance we will see the “deny” flow for HEP? <br/>
I tried two use cases so far: <br/>
<br/>
With EKS, I open the port in EKS security group for 0.0.0.0 cidr, and apply policy to deny all then allow one cidr from external server. <br/>
I was able to see the allow flow with external public IP but not able to see other deny flow logs. <br/>
<br/>
With AKS,  I peered my vm vnet and AKS vnet, and was able to deny the traffic from vm to one of AKS node by apply a deny policy with private ip of vm. <br/>
However, I’m not able to see the flow logs in service graph (including allow & deny flow from my VM). <br/>

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
