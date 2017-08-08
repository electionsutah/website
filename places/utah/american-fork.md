---
layout: page
title: American Fork
permalink: /places/utah/american-fork/
---

<!-- <section class="notice">
  <p>{{ site.data.places.american_fork.wikipedia_snippet }} (<a href="{{ site.data.places.american_fork.wikipedia_url }}"><span>Wikipedia</span></a>)</p>
</section> -->

### 2017 Primary Candidates

{% include 2017-municipal-election.html %}

{% assign city = site.data.2017.primary.candidates | where:'city','American Fork' | sort:'name' %}
<table>
<thead>
  <th>Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in city  %}
  <tr>
    <td><a href="../../../people/{{member.id}}">{{member.name}}</a></td>
    <td>{{ member.body }}</td>
    <td><a href="../../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="../../../places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
