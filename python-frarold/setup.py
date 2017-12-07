#!/usr/bin/python
import os
from setuptools import setup

with open('requirements.txt') as f:
    required = f.read().splitlines()

setup(
    name='python-frarold',
    version='1.0.0',
    author='Sean MacPherson',
    author_email='sjmb2017@mymail.pomona.edu',
    # install_requires=required,
    dependency_links=[
        'git+https://github.com/smacpher/dialogflow-python-client.git@master#egg=dialogflow-python',

    ],
    scripts=['bin/frarold'],
)
