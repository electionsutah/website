---
layout: page
title: Summit County
permalink: /places/summit/
comments: true
---

<!-- <section class="notice">
  <p>{{ site.data.places.utah_county.wikipedia_snippet }} (<a href="{{ site.data.places.utah_county.wikipedia_url }}"><span>Wikipedia</span></a>)</p>
</section> -->

### 2017 Municipal Election

{% include 2017-municipal-election.html %}

### 2017 Primary Candidates
{% assign county = site.data.2017.primary.candidates | where:'county','Summit' | sort:'name' %}
<table>
<thead>
  <th>Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in county  %}
  <tr>
    <td><a href="../../people/{{member.id}}">{{member.name}}</a></td>
    <td>{{ member.body }}</td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="../../places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>